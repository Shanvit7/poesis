<p align="center">
  <img src="https://raw.githubusercontent.com/Shanvit7/poiesis/main/apps/web/public/logo.svg" width="72" alt="Poiesis logo" />
  <h1 align="center">@shanvit7/poiesis</h1>
  <p align="center">
    <a href="https://www.npmjs.com/package/@shanvit7/poiesis"><img src="https://img.shields.io/npm/v/@shanvit7/poiesis?color=4f46e5&label=npm&style=flat-square" alt="npm version" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@shanvit7/poiesis?color=22c55e&style=flat-square" alt="License: MIT" /></a>
    <a href="https://github.com/Shanvit7/poiesis/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" /></a>
    <a href="https://pi.earendil.works"><img src="https://img.shields.io/badge/pi--package-%E2%9C%93-7c3aed?style=flat-square" alt="pi-package" /></a>
  </p>
</p>

A [pi](https://pi.earendil.works) extension that turns any YouTube coding tutorial into a hands-on, test-driven build session.

Pi reads the video, profiles your existing experience, and codes through it chapter by chapter — running every step itself, explaining each decision, and making sure you understand what's being built and why.

---

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [What a session looks like](#what-a-session-looks-like)
- [Command review](#command-review)
- [Project structure](#project-structure)
- [Bundled extensions and skills](#bundled-extensions-and-skills)
- [Registered tools](#registered-tools)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Contributing](#contributing)
- [License](#license)

---



## Features

- **One command** — `/poiesis` does everything: onboard, scaffold, and run chapters
- **Profile-aware** — scans your GitHub repos to calibrate depth, skips what you already know
- **Gemini-powered analysis** — feeds the YouTube URL to Gemini, extracts chapters, tech stack, and concepts automatically
- **Strict TDD flow** — Pi writes the tests; you never write tests. Chapters cannot be marked done until tests are green
- **Interactive test-plan review** — a full-screen TUI dialog lets you approve, add, or trim checkpoints before a single test is written
- **Command review gate** — every shell command Pi wants to run is intercepted and shown to you first: run, steer, skip, or ask for an explanation
- **Theory quizzes** — wrong answers are implemented and run so you see the failure before the fix
- **Prerequisite gate** — if a chapter's tech is new to you, Pi runs a short primer before the chapter starts
- **Session-safe** — chapter state persists across context compactions; Pi picks up exactly where it left off

---



## Install

```bash
pi install npm:@shanvit7/poiesis
```

Requires a free Gemini API key — get one at [aistudio.google.com](https://aistudio.google.com/app/apikey):

```bash
export GEMINI_API_KEY=your-key-here
```

---



## Usage

Everything runs through one command:

```bash
/poiesis
```

Pi decides what to do based on context:


| Situation                         | What happens                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| No profile yet                    | Onboarding — pi scans your GitHub and asks a few questions to build your profile   |
| Profile exists, no active project | Pi asks for a YouTube URL, analyzes the video with Gemini, and scaffolds a project |
| Inside an active project          | Pi resumes the chapter session from where you left off                             |


---



## What a session looks like



### Onboarding

Pi scans your GitHub repos (or you describe your projects if preferred) to understand your stack and background. This calibrates every chapter going forward — what to explain, what to skip, and how deep to go.

Profile is saved to `~/.poiesis/user-profile.json`.

### Project setup

Paste a YouTube URL. Pi uses Gemini to analyze the video — chapters, tech stack, concepts, and key takeaways — then scaffolds a project directory:

```
<project-name>/
  .poiesis/
    chapters/
      .progress.json        ← tracks current chapter and test status
      chapter-index.md      ← video overview and chapter map
      chapter-1.md          ← concepts, learning goals, tutor notes
      chapter-2.md
      ...
  .gitignore
```



### Chapter session

Each chapter follows a structured flow:

1. **Prerequisite gate** — Pi checks whether the chapter's tech is familiar given your profile. If not, it runs a short quiz and primes you before starting.
2. **Theory and quiz** — Pi explains the core concepts for this chapter. Wrong answers are implemented and tested so you see the failure before the correction.
3. **Test plan** — Pi proposes what to verify, shown in a full-screen dialog. You approve or adjust.
4. **Test file** — Pi writes the test file. You do not write tests.
5. **Implementation** — Pi codes through the chapter, narrating each decision. You make design calls when asked; Pi handles all shell commands.
6. **Done** — Tests pass, chapter is marked complete, next chapter queued.

Pi runs all commands. You only answer questions.

---



## Command review

During an active chapter session, every shell command Pi wants to execute is intercepted and shown to you in a TUI review dialog before it runs:

```
╔══════════════════════════════════╗
║  Command Review                  ║
║                                  ║
║  npx vitest run tests/ch-1.test  ║
║                                  ║
╟──────────────────────────────────╢
║  > Run it                        ║
║    Steer                         ║
║    Skip — don't run this         ║
║    Explain first                 ║
╚══════════════════════════════════╝
```


| Choice            | What happens                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| **Run it**        | Command executes immediately                                              |
| **Steer**         | You type a correction (e.g. "use pnpm, not npm") — Pi adjusts and retries |
| **Skip**          | Command is blocked; Pi continues without running it                       |
| **Explain first** | Pi explains what the command does and why before re-proposing             |


Read-only commands (`cat`, `ls`, `grep`, `find`, etc.) are auto-approved and bypass the dialog.

---



## Project structure

```
~/.poiesis/
  user-profile.json         ← your stack and recent projects (built during onboarding)
```

```
<project-name>/
  .poiesis/
    chapters/
      .progress.json
      chapter-N.md
```

---



## Bundled extensions and skills



### @juicesharp/rpiv-ask-user-question

Registers the `ask_user_question` tool — a structured TUI option selector with typed choices and a free-text fallback. Pi uses this throughout onboarding and chapter sessions wherever a multiple-choice prompt is more precise than a free-form reply.

Source: [npmjs.com/package/@juicesharp/rpiv-ask-user-question](https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question)

### agent-browser (skill)

When Pi is unsure about an API, config shape, or error message during your session, it opens the relevant documentation in a headless browser and quotes the live source rather than guessing from training data.

Both are loaded automatically — you don't need to invoke them manually.

---



## Registered tools

The extension registers the following tools, which Pi calls internally during chapter sessions:


| Tool                        | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `poiesis_save_profile`      | Persists the user profile after onboarding                |
| `poiesis_confirm_test_plan` | Shows the test-plan TUI and captures the student's choice |
| `poiesis_run_tests`         | Runs the chapter's test suite and records pass/fail       |
| `poiesis_chapter_done`      | Marks a chapter complete — gated on tests passing         |
| `poiesis_prereq_done`       | Records the prereq gate result and fires the theory step  |
| `poiesis_theory_done`       | Fires the test-plan step once theory is understood        |
| `poiesis_tests_written`     | Records the test file path and fires the implement step   |


---



## Prerequisites

- `[pi](https://pi.earendil.works)` — the coding agent
- `GEMINI_API_KEY` — free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---



## Local development

```bash
# Install from local path
pi install /path/to/poiesis/apps/pi-extension

# Test without installing
pi -e /path/to/poiesis/apps/pi-extension

# Hot-reload after edits (inside pi)
/reload
```

---



## Contributing

Contributions are very welcome — whether it's a bug fix, a new feature, better prompts, or just improving the docs.

### Ways to contribute

- **Bug reports** — open an issue with steps to reproduce and the chapter/step where it broke
- **Feature ideas** — open a discussion; the best ones get fast-tracked
- **Code** — fork, branch off `main`, open a PR; see the dev loop above
- **Prompts** — the `prompts/` directory contains the step prompts Pi uses; improving them has the highest leverage
- **Eval cases** — `promptfooconfig.yaml` drives the evals; adding cases for tricky scenarios is incredibly valuable



### Getting started

```bash
git clone https://github.com/shanvit7/poiesis
cd poiesis
pnpm install
cd apps/pi-extension
bun install
```

Run the evals:

```bash
cd apps/pi-extension
pnpm eval
```



### Guidelines

- The command-review gate must not be bypassable during an active session
- Prompts live in `prompts/`; logic lives in `src/`; keep them separate
- Open an issue before a large refactor so we can align first

All contributors are credited in the changelog.

---



## License

MIT © [shanvit7](https://github.com/shanvit7)

See [LICENSE](./LICENSE) for the full text.