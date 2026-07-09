# Tech Architecture

This is a living doc. Update it as decisions get made.

---

## Components

### 1. Chrome Extension (`apps/extension`)

The only thing running on the user's browser. It has two jobs:

- **Observe** — content script runs on `youtube.com/watch`, picks up the video being watched (metadata, transcript)
- **Decide** — filters whether the video is worth storing (heuristics: length, category, skip rate, etc.) before sending anything
- **Hand off** — sends the payload to the API backend

The extension does not talk to Supermemory directly. It only talks to our API.

The extension also has a popup. What that shows is TBD, but at minimum it needs to let the user log in and see that it's working.

**Auth in the extension:**
The extension cannot share cookies with the web app (different origin). So the flow is:
- User clicks "Login" in the popup — opens a tab to the web app login
- User completes Google login there
- Backend issues a long-lived API token
- Extension retrieves and stores that token in `chrome.storage`
- All subsequent API calls from the extension include that token in headers

---

### 2. Next.js Frontend (`apps/web` — pages/UI side)

The web dashboard. Users come here to:

- Log in (Google via Better Auth)
- Browse their saved memories
- Search across everything Supermemory has stored for them
- Manage their account

This is a standard Next.js app. Pages talk to the API routes in the same app.

---

### 3. Next.js API Backend (`apps/web` — route handlers)

The backend lives inside the same Next.js app as API routes (`/api/*`). It is the only thing that talks to Supermemory.

Responsibilities:

- **Auth** — Better Auth handles session management and Google OAuth. All routes that touch memories are protected.
- **Receive from extension** — `POST /api/memories` accepts the video payload from the extension (after verifying the API token)
- **Process** — extracts concepts from the transcript (how exactly is TBD — could be an LLM call, could be simpler)
- **Write to Supermemory** — stores the processed memory, tagged to the user
- **Search** — proxies semantic search queries from the frontend to Supermemory and returns results

Supermemory API keys and the Supermemory URL never leave the server.

---

## Auth

**Library**: [Better Auth](https://www.better-auth.com/)  
**Provider**: Google only (for now)

Two auth surfaces:

| Surface | Method |
|---|---|
| Web dashboard | Better Auth session cookie (standard) |
| Chrome extension | API token issued by Better Auth after web login |

User data in Supermemory is always scoped to the authenticated user. No user sees another user's memories.

---

## Data flow (end to end)

```
User watches YouTube video
  -> content script grabs transcript + metadata
  -> extension decides: worth saving?
  -> POST /api/memories (with API token)
  -> backend verifies token
  -> backend processes transcript
  -> backend writes to Supermemory (scoped to user)

User opens dashboard
  -> logs in with Google (Better Auth)
  -> searches or browses
  -> GET /api/search or /api/memories
  -> backend queries Supermemory
  -> returns results
```

---

## Open questions

- How does concept extraction work — LLM call, keyword extraction, or something else?
- What does the extension popup show beyond login status?
- How do we handle videos the user skips through (partial watch)?
- Supermemory user scoping — one space per user, or tags?
- Do we need a separate token refresh mechanism or is a long-lived token fine for the hackathon?
