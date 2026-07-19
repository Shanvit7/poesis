# Poiesis — Reliable Harness Plan

## The Problem

The current harness injects a 120-line prompt via `sendUserMessage` and hopes the LLM follows
all 6 steps in order. It won't — reliably. The LLM skips the prereq gate, merges steps,
or forgets rules mid-session. Every bug we fixed this session was an LLM ignoring an instruction.

## The Fix: State Machine + Tool Gates

Replace one big prompt with a **sequenced harness**: each step gets its own short prompt,
and the LLM can only advance by calling a specific gate tool. The next step doesn't exist
until the gate fires. Skipping is structurally impossible.

```
Step 0  sendUserMessage(PREREQ_PROMPT)
           │
           └── LLM calls poiesis_prereq_done({result})
                         │
Step 1              sendUserMessage(THEORY_PROMPT)
                         │
                         └── LLM calls poiesis_theory_done()
                                       │
Step 2                           sendUserMessage(PLAN_PROMPT)
                                       │
                                       └── LLM calls poiesis_confirm_test_plan({tests})
                                                     │
Step 3                                         sendUserMessage(WRITE_TESTS_PROMPT)
                                                     │
                                                     └── LLM calls poiesis_tests_written({testsFile})
                                                                   │
Step 4                                                       sendUserMessage(IMPLEMENT_PROMPT)
                                                                   │
                                                                   └── LLM calls poiesis_run_tests({cmd})
                                                                                 │
Step 5                                                                     tests pass → poiesis_chapter_done()
                                                                           tests fail → retry loop
```

---

## Step Prompts (short, scoped, no repetition)

Each prompt is 10–20 lines max. Chapter content lives in the system prompt (injected once via
`before_agent_start`) — not repeated in every message.

### PREREQ_PROMPT
```
The student's profile is in the system context. Look at this chapter's primary tech.
Is it in their known stack or project summaries?

FAMILIAR → call poiesis_prereq_done with result="familiar"
UNFAMILIAR → ask 2-3 prerequisite questions via ask_user_question first, then call
             poiesis_prereq_done with result="primed" (regardless of score)

Never block progress. The goal is calibration.
```

### THEORY_PROMPT (includes prereq result via tool params)
```
Prereq result: {prereqResult}

Introduce what will be built by the end of this chapter (2-3 sentences).
Then explain the core "what and why" — no code yet.
  - familiar: tradeoffs and edge cases only
  - primed: full explanation with an analogy

Quiz with 1-2 questions via ask_user_question. Wrong answer → implement it →
call poiesis_run_tests to show the failure → explain why → revert.

When done: call poiesis_theory_done()
```

### PLAN_PROMPT
```
Propose 3-5 tests as learning checkpoints. Call poiesis_confirm_test_plan with the list.
Do NOT write the list in chat. The tool renders a full-screen dialog.
```

### WRITE_TESTS_PROMPT
```
Tests confirmed: {testPlan}

Choose the right test framework for this chapter's tech. Write the test file.
Name tests after behaviour: server_returns_200_on_root not test_server.
When written: call poiesis_tests_written with the file path.
```

### IMPLEMENT_PROMPT
```
Test file: {testsFile}

Before each code block: one sentence on WHAT you're adding and WHY.
YOU run all shell commands via bash. Student never runs commands manually.
For interactive CLIs: use non-interactive flags.
Student HITL = design decisions only (ask_user_question). Not commands.

Wrong design choice by student → implement it → call poiesis_run_tests → show failure → correct.
If a command fails 3 times: explain and ask student. Otherwise handle silently.

Make {testsFile} pass. Don't modify the test file.
Call poiesis_run_tests with cmd="<runner> <file>" when ready.
```

---

## Gate Tools (new/renamed)

| Tool | Params | Action |
|------|--------|--------|
| `poiesis_prereq_done` | `result: "familiar"\|"primed"` | Stores result, fires THEORY_PROMPT |
| `poiesis_theory_done` | — | Fires PLAN_PROMPT |
| `poiesis_confirm_test_plan` | `tests: {name,why}[]` | TUI dialog → stores plan, fires WRITE_TESTS_PROMPT |
| `poiesis_tests_written` | `testsFile: string` | Stores path, updates progress, fires IMPLEMENT_PROMPT |
| `poiesis_run_tests` | `cmd: string` | Runs test cmd; pass → fires chapter_done; fail → retry |
| `poiesis_chapter_done` | — | Marks chapter complete, shows next |

Existing tools `poiesis_save_profile` and `poiesis_run_tests` stay. The rest are restructured.

---

## Context Injection (token efficiency)

### `before_agent_start` — inject once, not per message

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  if (!isActiveChapterSession()) return
  return {
    systemPrompt: event.systemPrompt + buildChapterContext(chapterMd, profile)
  }
})
```

`buildChapterContext` outputs:
```
## Active Chapter: N — <title>
Student stack: TypeScript, Hono
Recent projects:
  - hono-api: REST API with Hono on Cloudflare Workers [TypeScript, Hono]

Chapter content:
<chapterMd trimmed to ~2000 tokens>
```

This fires ONCE per turn. It's not stored in session history as a user message. No repetition.

### `context` event — prune after tests are written

After `poiesis_tests_written` fires (step 3 → 4), the full chapter markdown is no longer needed.
The `context` event prunes it from the injected context going forward:

```typescript
pi.on("context", async (event, ctx) => {
  if (chapterStep >= "implement") {
    return { messages: pruneChapterContent(event.messages) }
  }
})
```

### `session_before_compact` — chapter-aware summary

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  return {
    compaction: {
      summary: buildChapterSummary({
        chapterNum,
        step: currentStep,      // e.g. "implement"
        prereqResult,           // "familiar" | "primed"
        testsFile,              // "tests/chapter-3.test.ts"
        testsPlan,              // [{name, why}, ...]
        testsPass,              // true | false
      }),
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    }
  }
})
```

The summary is ~200 tokens. The LLM re-enters knowing exactly where it is after compaction.

---

## Token Saving: Caveman Mode + RTK

**Checked pi.dev/packages — neither "caveman" nor "rtk" exist as published pi packages.**
Implementing the equivalent inline:

**Caveman mode** — terse output via `before_agent_start` system prompt injection:
```typescript
// Added to buildChapterContext(), applies only during implement step
const CAVEMAN_GUIDELINE = `
During implementation steps: respond in minimal prose.
One action per message. No preamble, no summary, no "Great!" or "Sure!".
Format: [what you did] → [result]. Nothing more.
Code first. Explanation only if explicitly asked.
`
```
This is the inline equivalent. Saves 30-50% output tokens during the longest step.

**RTK (token reduction)** — implemented via `context` event message pruning:
```typescript
// Prune after tests are written: chapter content no longer needed
// Prune after each step completes: step prompt no longer needed
pi.on("context", async (event, ctx) => {
  if (currentStep === "implement") {
    return { messages: pruneStepMessages(event.messages, ["prereq", "theory", "plan"]) }
  }
})
```
Combined with the custom compaction summary, this keeps context lean throughout the session.

---

## State Persistence

Chapter step state stored in `.poiesis/chapters/chapter-N.state.json`:
```json
{
  "step": "implement",
  "prereqResult": "primed",
  "testsFile": "tests/chapter-3.test.ts",
  "testsPlan": [{ "name": "server returns 200", "why": "proves the server starts" }],
  "testsPass": false,
  "startedAt": "2026-07-19T08:00:00Z"
}
```

This survives session crashes and compaction. On `/poiesis` in an active chapter,
`runChapter` reads the state and re-fires the correct step prompt — not from step 0.

---

## Implementation Order

1. **State file** — add `readChapterState` / `writeChapterState` to `utils.ts`
2. **Gate tools** — add `poiesis_prereq_done`, `poiesis_theory_done`, `poiesis_tests_written` to `index.ts`
3. **Step prompts** — move prompt strings out of `chapterPrompt()` into `src/steps.ts` (one const per step)
4. **`runChapter` rewrite** — read state, fire the right step prompt
5. **`before_agent_start`** — inject chapter context to system prompt (not user message)
6. **`context` event** — prune chapter content after implement step
7. **`session_before_compact`** — custom chapter-aware compaction summary
8. **Caveman + RTK** — check pi.dev/packages; install or implement fallback
9. **Self-checks** — update `chapter.ts` assertions for new step structure
10. **Smoke test** — run `/poiesis` in hono-api, confirm each step gates correctly

---

## What Doesn't Change

- `classifyChapter` (Gemini — code vs theory)
- `poiesis_save_profile` + onboarding flow
- `poiesis_confirm_test_plan` TUI dialog
- `.poiesis/chapters/` directory structure
- Bash command review gate (`tool_call` interceptor)
- Wrong-answer TDD path (now baked into THEORY_PROMPT and IMPLEMENT_PROMPT)
- `RecentProject[]` profile shape
