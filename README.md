<p align="center">
  <img src="apps/web/src/app/icon.svg" width="72" alt="Poiesis logo" />
  <h1 align="center">Poiesis</h1>
  <p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-C62C5A?style=flat-square" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/status-early_access-C62C5A?style=flat-square" alt="Status" />
    <a href="https://aistudio.google.com/app/apikey"><img src="https://img.shields.io/badge/requires-Gemini_API-4285F4?style=flat-square&logo=google&logoColor=white" alt="Requires Gemini" /></a>
  </p>
</p>

> Your AI coding tutor for YouTube tutorials.

Point it at a video. It reads the content deeply, asks you the right questions, and guides you through building the project — chapter by chapter.

---

## How it works

1. **Ingest** — Poiesis reads the tutorial video and extracts chapters, stack, concepts, and prereqs.
2. **Tutor session** — Your AI agent becomes a knowledgeable guide for this specific video. It asks you questions, recommends patterns, and corrects wrong assumptions in real time.
3. **Lab** — A local project is scaffolded. Each chapter gets a lab doc with exercises and guidance. You write the code; the agent tutors you through it.

---

## Get started

Currently ships as a **[pi](https://pi.earendil.works) extension**. See [`apps/pi-extension/README.md`](./apps/pi-extension/README.md) for setup and usage.

**Requires:** `GEMINI_API_KEY` — get one at [aistudio.google.com](https://aistudio.google.com/app/apikey).

---

## License

MIT
