# @shanvit7/poiesis

A [pi](https://pi.earendil.works) extension that turns any YouTube coding tutorial into a hands-on, test-driven build session.

Pi reads the video, profiles your existing experience, and codes through it chapter by chapter — running every step itself, explaining each decision, and making sure you understand what's being built and why.

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

| Situation | What happens |
|-----------|-------------|
| No profile yet | Onboarding — pi scans your GitHub and asks a few questions to build your profile |
| Profile exists, no active project | Pi asks for a YouTube URL, analyzes the video with Gemini, and scaffolds a project |
| Inside an active project | Pi resumes the chapter session from where you left off |

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
      .progress.json        <- tracks current chapter and test status
      chapter-index.md      <- video overview and chapter map
      chapter-1.md          <- concepts, learning goals, tutor notes
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

## Project structure

```
~/.poiesis/
  user-profile.json         <- your stack and recent projects (built during onboarding)
```

```
<project-name>/
  .poiesis/
    chapters/
      .progress.json
      chapter-N.md
```

---

## Prerequisites

- [`pi`](https://pi.earendil.works) — the coding agent
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
