import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import { GoogleGenAI } from "@google/genai"
import { setChapterMeta } from "./progress.ts"
import { readProgress } from "./progress.ts"
import type { ChapterKind, RecentProject, UserProfile } from "./types.ts"
import { exists, expandHome } from "./utils.ts"

// ── Helpers ───────────────────────────────────────────────────────────────────

const chaptersDir = (projectDir: string): string =>
  join(expandHome(projectDir), ".poiesis", "chapters")

const chapterFile = (projectDir: string, n: number): string =>
  join(chaptersDir(projectDir), `chapter-${n}.md`)

const roadmapJsonFile = (projectDir: string): string =>
  join(chaptersDir(projectDir), "roadmap.json")
const techstackFile = (projectDir: string): string => join(chaptersDir(projectDir), "techstack.md")

const readFile = (path: string): string => readFileSync(path, "utf8")
const writeFile = (path: string, content: string): void => writeFileSync(path, content, "utf8")

// ── classifyChapter ───────────────────────────────────────────────────────────

/**
 * One Gemini call — classifies a chapter as "code" | "theory".
 * ponytail: mixed removed — any chapter with runnable output is "code".
 */
export const classifyChapter = async (
  chapterMd: string,
  primaryStack: string[]
): Promise<ChapterKind> => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

  const ai = new GoogleGenAI({ apiKey })
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Classify this tutorial chapter. Primary stack: ${primaryStack.join(", ")}.

Reply with exactly one word: "code" or "theory".

- "code": chapter involves writing runnable code — even if it also explains concepts
- "theory": chapter is PURELY conceptual — no runnable output whatsoever

Chapter content:
${chapterMd}`,
          },
        ],
      },
    ],
  })

  const raw = (result.text ?? "").trim().toLowerCase()
  if (raw === "theory") return "theory"
  return "code" // ponytail: default — any ambiguity leans code; mixed → code
}

// ── TDD file operations ───────────────────────────────────────────────────────

/**
 * Append a ## TDD section to chapter-N.md after classification + test writing.
 * Called once, before the RED phase begins.
 */
export const writeTddSection = (
  projectDir: string,
  chapter: number,
  testsFile: string,
  testNames: string[]
): void => {
  const path = chapterFile(projectDir, chapter)
  const existing = readFile(path)
  const section = `\n## TDD\n- Test file: \`${testsFile}\`\n- Status: 🟡 written, not passing\n- Tests: ${testNames.join(", ")}\n`
  writeFile(path, `${existing}${section}`)
}

/**
 * Update the Status line inside the ## TDD section.
 * ponytail: regex replace — avoids re-parsing the whole file.
 */
export const appendTddStatus = (projectDir: string, chapter: number, status: string): void => {
  const path = chapterFile(projectDir, chapter)
  const content = readFile(path)
  const updated = content.replace(/- Status: .+/, `- Status: ${status}`)
  writeFile(path, updated)
}

/**
 * Append a ## Reflection section to chapter-N.md on chapter_done.
 */
export const appendReflection = (projectDir: string, chapter: number, reflection: string): void => {
  const path = chapterFile(projectDir, chapter)
  const existing = readFile(path)
  writeFile(path, `${existing}\n## Reflection\n\n${reflection}\n`)
}

/**
 * Tick the chapter off in roadmap.json.
 */
export const checkOffChapter = (projectDir: string, chapter: number, kind: ChapterKind): void => {
  const path = roadmapJsonFile(projectDir)
  if (!exists(path)) return
  const roadmap = JSON.parse(readFile(path)) as {
    name: string
    chapters: Array<{
      n: number
      title: string
      duration: string
      done: boolean
      kind: ChapterKind | null
    }>
  }
  const entry = roadmap.chapters.find((c) => c.n === chapter)
  if (entry) {
    entry.done = true
    entry.kind = kind
  }
  writeFile(path, JSON.stringify(roadmap, null, 2))
}

/**
 * Build the LLM injection for a chapter session.
 *
 * Code chapter flow (6 steps):
 *   1. Introduce what will be built
 *   2. Theory foundations + level-calibrated quiz (what & why before any code)
 *   3. Propose test plan
 *   4. Write test file
 *   5. Implement with "what & why" narration + wrong-answer TDD path
 *   6. Run tests → chapter_done
 *
 * Theory chapter: concepts → quiz → chapter_done (no code, no tests)
 */
export const chapterPrompt = (
  chapterMd: string,
  kind: ChapterKind,
  chapterNum: number,
  techstackMd = "",
  primaryStack: string[] = [],
  recentProjects: RecentProject[] = []
): string => {
  const profileContext = [
    `Stack:    ${primaryStack.join(", ") || "unknown"}`,
    "Projects:",
    ...recentProjects.map((p) => `  - ${p.name}: ${p.summary} [${p.stack.join(", ")}]`),
  ].join("\n")
  const tddSection =
    kind === "code"
      ? `
## Chapter session — follow these steps IN ORDER

You are a patient tutor, not a code generator.

**Step 0 — Prerequisite gate (run FIRST, before anything else)**

The student's profile:
${profileContext}

Look at this chapter's primary tech. Does it appear in their stack or project summaries?

FAMILIAR (tech is in their stack or they've built something with it):
  → Acknowledge in one sentence ("Looks like you've worked with X before — let's move fast.")
  → Skip the primer. Go directly to Step 1 with concise, tradeoff-focused explanations.

UNFAMILIAR (tech NOT in their known stack or projects):
  → Ask 2–3 prerequisite questions via ask_user_question about this chapter's foundational concept.
  → Scoring:
      2+ correct → proceed to Step 1 with normal depth
      0–1 correct → give a focused primer (key concept + one analogy, ~5 min read),
                    re-quiz once, then proceed regardless — never block progress

The gate outcome calibrates ALL remaining steps:
- Familiar / 2+ correct → concise, assume competence, focus on tradeoffs and edge cases
- Needed primer → slower pace, more analogies, explain before doing

**Step 1 — Introduce what will be built**
In 2–3 sentences: what concrete thing will the student have working by the end?
Frame it as an outcome, not a topic list. Calibrate depth based on Step 0 outcome.

**Step 2 — Theory foundations + quiz (before any code or tests)**
Explain the core "what and why" behind this chapter's approach — no code yet.
Calibrate depth based on Step 0 outcome.

Then quiz with 1–2 questions via ask_user_question:

⚠️ WRONG-ANSWER TDD PATH — if the student answers incorrectly:
1. Say "Let's see what happens" — don't reveal the answer
2. Implement their wrong answer via write/bash tools
3. Call \`poiesis_run_tests\` — the test will fail
4. Show the failure output in 1 sentence
5. Explain WHY it failed (the correct concept) in 2–3 sentences
6. Revert to the correct implementation
This makes the wrong path a teaching moment, not a dead end.

**Step 3 — Propose a test plan (DO NOT write code or call ask_user_question)**
Think of tests as learning checkpoints — each one proves the student built something real.

Call \`poiesis_confirm_test_plan\` with:
- chapterNum: ${chapterNum}
- intro: 1–2 sentences describing what the student will have built by the end
- tests: array of { name, why } — name in plain words, why in one sentence

Do NOT write the list in chat first. Do NOT call ask_user_question. The tool renders
its own full-screen dialog. Just call the tool.

If the tool returns "add": ask the student what to add, then re-call with the updated list.
If "skip": ask which one, then re-call without it.

**Step 4 — Write the test file**
Based on the chapter's tech stack, choose the right test framework and an appropriate file path
(e.g. \`tests/chapter-N.test.ts\` + vitest for TS, \`tests/test_chapter_N.py\` + pytest, etc.).
Write the test file yourself using the write tool.
Name tests after behaviour: \`server_returns_200_on_root\` not \`test_server\`.
No mocking unless I/O is the point.
After writing: "Done — <your test file> is our contract. Let's make these pass."

**Step 5 — YOU implement. Student is HITL for decisions + wrong-answer TDD.**

⚠️ CRITICAL RULES — violating these is a bug:
1. YOU run every shell command via the bash tool. The student NEVER runs commands manually.
   BAD: "Run this in your terminal: npm install"
   GOOD: call bash with "cd <project-dir> && npm install"

2. For interactive CLI scaffolders (npm create, create-vite, etc.) use non-interactive flags.
   GOOD: \`npm create hono@latest . -- --template cloudflare-workers\`
   NEVER ask the student to pick answers in their terminal.

3. Student HITL = architecture/design DECISIONS only.
   Ask via ask_user_question for: which template, library choice, project structure.
   Do NOT ask for: running commands, installing packages, creating files.

4. "What & why" narration: before each significant code block, one sentence on WHAT
   you're adding and WHY — not a lecture, just intent.

5. Wrong-answer TDD on design choices: if the student picks a wrong design,
   implement it → call poiesis_run_tests → show failure → explain → correct.

6. If a command fails 3 times: THEN explain and ask the student. Otherwise handle silently.

Your code MUST make the test file you wrote pass. Don't modify the test file.
If a test seems wrong: raise it via ask_user_question before touching it.

**Step 6 — Run & complete**
Call \`poiesis_run_tests\` with chapter=${chapterNum} and cmd="<the runner + test file you chose>".
Fail → YOU diagnose + fix + re-run. No student involvement unless stuck after 3 attempts.
Pass → call \`poiesis_chapter_done\`.
`
      : ""

  const theoryGate =
    kind === "theory"
      ? `
## Theory chapter — no code, no tests

**Step 0 — Prerequisite gate (run FIRST)**

The student's profile:
${profileContext}

FAMILIAR: acknowledge in one sentence, proceed with concise tradeoff-focused questions.
UNFAMILIAR: 2–3 foundation questions → if <2 correct, give a primer, re-quiz once.
Calibrate all remaining steps based on the gate outcome.

Then:
1. Introduce the chapter concepts in 2–3 sentences — what and why, not a feature list.
2. Quiz the student on each key idea via ask_user_question.
   Calibrate question style based on Step 0 outcome:
   - Familiar / passed: "What are the tradeoffs?" / "What edge case does this miss?"
   - Needed primer: "What is X?" / "Why Y instead of Z?"
3. Wrong answer → gently correct with a brief explanation, then re-ask.
4. Once they demonstrate understanding of all key concepts, call \`poiesis_chapter_done\`.
`
      : ""

  const techstackSection = techstackMd ? `## Project Tech Stack\n\n${techstackMd}\n\n---\n\n` : ""

  return `# Chapter ${chapterNum} — Session

You are a patient, encouraging tutor. The student may be a beginner or an expert — calibrate your
explanations to their responses.

${techstackSection}Here is the chapter content for reference:

---
${chapterMd}
---
${tddSection}${theoryGate}`
}

// ── runChapter ────────────────────────────────────────────────────────────────

/**
 * Orchestrate one chapter: classify → inject prompt → hand off to LLM.
 */
export const runChapter = async (
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  profile: UserProfile,
  projectDir: string
): Promise<void> => {
  const p = readProgress(projectDir)
  const n = p.current
  const path = chapterFile(projectDir, n)

  if (!exists(path)) {
    ctx.ui.notify(`Chapter ${n} file not found at ${path}`, "error")
    return
  }

  const chapterMd = readFile(expandHome(path))

  // Classify (Gemini) — updates .progress.json
  ctx.ui.setStatus("poiesis", ` Classifying chapter ${n}…`)
  let kind: ChapterKind = "code"
  try {
    kind = await classifyChapter(chapterMd, profile.primaryStack)
  } catch {
    // ponytail: fall back to 'code' if Gemini is unavailable
  }

  // pi decides the test file and runner from context — no heuristic here
  setChapterMeta(projectDir, n, kind, null)
  ctx.ui.setStatus("poiesis", undefined)

  // Read techstack.md — lets the agent know the runtime/PM/framework without asking
  const tsPath = techstackFile(projectDir)
  const techstackMd = exists(tsPath) ? readFile(expandHome(tsPath)) : ""

  const prompt = chapterPrompt(
    chapterMd,
    kind,
    n,
    techstackMd,
    profile.primaryStack,
    profile.recentProjects
  )
  await pi.sendUserMessage(prompt)
}

// ── self-check ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("chapter.ts")) {
  ;(async () => {
    const { tmpdir } = await import("node:os")
    const { mkdirSync, rmSync } = await import("node:fs")
    const { initProgress } = await import("./progress.ts")

    const dir = join(tmpdir(), `poiesis-chapter-${Date.now()}`)
    const chDir = join(dir, ".poiesis", "chapters")
    mkdirSync(chDir, { recursive: true })

    // seed files
    writeFile(join(chDir, "chapter-1.md"), "# Chapter 1 — Intro\n\nSome content.\n")
    writeFile(
      join(chDir, "techstack.md"),
      "**Runtime**: Bun\n**Package manager**: bun\n**Framework**: Hono\n"
    )
    writeFile(
      join(chDir, "roadmap.json"),
      JSON.stringify(
        {
          name: "Project",
          chapters: [{ n: 1, title: "Intro", duration: "0:00-5:00", done: false, kind: null }],
        },
        null,
        2
      )
    )
    initProgress(dir, 2, {
      "1": { type: "code", testsFile: null, testsPass: false },
      "2": { type: "theory", testsFile: null, testsPass: null },
    })

    // writeTddSection
    writeTddSection(dir, 1, "tests/chapter-1.test.ts", ["server returns 200", "unknown route 404"])
    const after = readFile(join(chDir, "chapter-1.md"))
    console.assert(after.includes("## TDD"), "TDD section missing")
    console.assert(after.includes("🟡"), "initial status missing")

    // appendTddStatus
    appendTddStatus(dir, 1, "🟢 passing")
    const updated = readFile(join(chDir, "chapter-1.md"))
    console.assert(updated.includes("🟢 passing"), "status not updated")
    console.assert(!updated.includes("🟡"), "old status still present")

    // checkOffChapter
    checkOffChapter(dir, 1, "code")
    const roadmap = JSON.parse(readFile(join(chDir, "roadmap.json")))
    console.assert(roadmap.chapters[0].done === true, "chapter not ticked off")
    console.assert(roadmap.chapters[0].kind === "code", "kind not set")

    // appendReflection
    appendReflection(dir, 1, "Learned about routing.")
    const withReflection = readFile(join(chDir, "chapter-1.md"))
    console.assert(withReflection.includes("## Reflection"), "reflection section missing")

    // chapterPrompt — code chapter with profile context
    const testProjects = [
      { name: "hono-api", summary: "REST API with Hono", stack: ["TypeScript", "Hono"] },
    ]
    const prompt = chapterPrompt("# Ch1\nContent.", "code", 1, "", ["TypeScript"], testProjects)
    // Step 0 — prerequisite gate
    console.assert(prompt.includes("Prerequisite gate"), "Step 0 gate missing")
    console.assert(prompt.includes("FAMILIAR"), "FAMILIAR path missing")
    console.assert(prompt.includes("UNFAMILIAR"), "UNFAMILIAR path missing")
    console.assert(prompt.includes("hono-api"), "profile context (project name) missing")
    console.assert(prompt.includes("TypeScript"), "profile context (stack) missing")
    // Steps 1–6
    console.assert(prompt.includes("Introduce what will be built"), "intro step missing")
    console.assert(prompt.includes("Theory foundations"), "theory+quiz step missing")
    console.assert(prompt.includes("WRONG-ANSWER TDD PATH"), "wrong-answer TDD path missing")
    console.assert(prompt.includes("what and why"), "what-and-why narration missing")
    console.assert(prompt.includes("poiesis_confirm_test_plan"), "confirm tool call missing")
    console.assert(prompt.includes("poiesis_run_tests"), "run tests step missing")
    console.assert(
      prompt.includes("Do NOT call ask_user_question"),
      "step 3 must prohibit ask_user_question"
    )
    console.assert(prompt.includes("ask_user_question"), "hitl ask_user_question still needed")
    console.assert(prompt.includes("NEVER runs commands manually"), "agent must own all shell")
    console.assert(prompt.includes("non-interactive flags"), "must guide on non-interactive CLIs")
    console.assert(prompt.includes("fails 3 times"), "must define retry-then-escalate rule")
    // experienceLevel must NOT be statically baked in
    console.assert(!prompt.includes("experienceLevel"), "experienceLevel must not appear in prompt")
    // theory chapter
    const theoryPrompt = chapterPrompt("# Ch2\nConcepts.", "theory", 2, "", ["Go"], [])
    console.assert(
      !theoryPrompt.includes("test file"),
      "test file must not appear in theory prompt"
    )
    console.assert(theoryPrompt.includes("Theory chapter"), "theory gate missing")
    console.assert(theoryPrompt.includes("Prerequisite gate"), "theory also needs Step 0 gate")
    console.assert(theoryPrompt.includes("what and why"), "theory also needs what-and-why")

    rmSync(dir, { recursive: true })
    console.log("chapter.ts: ok")
  })()
}
