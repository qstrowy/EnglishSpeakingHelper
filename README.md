# 1-Minute Speaking Trainer

A lightweight, minimalist web app for solo English speaking practice.

---

## What it does

- Draws a random topic from a local topic bank
- Filters topics by difficulty (easy / medium / hard) and type (opinion / description / story / comparison / buzzword)
- Displays a 3-step suggested speaking structure tailored to the topic type
- Shows a dynamic prep tip by topic type (keywords-first prep guidance)
- Runs a configurable preparation timer (30 / 45 / 60 s)
- Runs a configurable speaking timer (60 / 90 / 120 s)
- Shows a compact "How to use this practice" micro-guide
- Adds a finished-state reflection hint before repeating the same topic
- Reinforces second-attempt learning with subtle repeat guidance
- Persists your preferences and recent topic history across sessions
- Optional auto-start: speaking timer begins automatically after prep ends

---

## Files

```
/
├── index.html     # App markup
├── style.css      # All styles
├── app.js         # All logic (vanilla JS, no dependencies)
└── topics.json    # Topic bank — easy to extend
```

---

## Running locally

> **Important:** The app fetches `topics.json` via `fetch()`, which requires a local HTTP server.  
> Opening `index.html` directly as a `file://` URL will fail in most browsers due to CORS restrictions.

### Option A — Python (built into macOS / Linux)

```bash
cd speaking-trainer
python3 -m http.server 8080
```
Then open: http://localhost:8080

### Option B — Node.js

```bash
npx serve .
```

### Option C — VS Code Live Server extension

Right-click `index.html` → **Open with Live Server**

---

## Deploying as a static site

No build step required. Just upload the four files to any static host.

### GitHub Pages

1. Push the folder to a GitHub repository
2. Go to **Settings → Pages → Source** and select the branch/folder
3. Your app is live at `https://<username>.github.io/<repo>/`

### Vercel

```bash
npx vercel
```
Select the project folder. That's it.

### Cloudflare Pages

1. Connect your GitHub repo in the Cloudflare Dashboard
2. Set build command to *(empty)* and output directory to `/`
3. Deploy

---

## Adding topics

Edit `topics.json`. Each topic follows this schema:

```json
{
  "id": 61,
  "text": "Your topic question here.",
  "difficulty": "medium",
  "type": "opinion",
  "tags": ["optional", "tags"]
}
```

**Valid values:**
- `difficulty`: `easy` | `medium` | `hard`
- `type`: `opinion` | `description` | `story` | `comparison` | `buzzword`
- `tags`: free-form array, not used for filtering in MVP

---

## Keyboard shortcuts

| Key       | Action                     |
|-----------|----------------------------|
| `N`       | New topic                  |
| `Space`   | Next step (context-aware)  |
| `P`       | Start prep timer           |
| `S`       | Start speaking timer       |
| `R`       | Repeat current topic       |

---

## Learning loop

The app now explicitly supports a lightweight practice cycle:

1. Draw a topic
2. Use prep time for keywords (not full sentences)
3. Speak for 1 minute
4. Reflect on where you hesitated or got stuck
5. Repeat the same topic and deliver a clearer second attempt

This keeps the MVP fast and minimal while improving educational value.

---

## State machine

```
IDLE → [New topic] → READY → [Start prep] → PREP → [auto or manual] → SPEAKING → FINISHED
                       ↑                                                    |
                       └────────────────[Repeat]────────────────────────────┘
```

---

## Future extension ideas

- Audio recording + playback
- LLM-generated topics
- Transcription + vocabulary feedback
- Stats dashboard / streaks
- Custom topic import (CSV / paste)
- Shareable topic sets via URL params
