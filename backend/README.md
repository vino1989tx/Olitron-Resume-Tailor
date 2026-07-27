# ResumeCraft AI Backend (FastAPI + Gemini)

A small FastAPI service that holds the **Google Gemini** API key server-side and
proxies AI generation for the Angular app. The key lives only in this server's
environment — it is **never** shipped to the browser.

## How it fits together

```
Angular UI  ──POST /api/generate {prompt, maxTokens}──▶  FastAPI (this)  ──▶  Gemini
   (no key)                                              (holds GEMINI_API_KEY)
```

The UI builds every prompt (parse / tailor / common-changes) and parses the JSON
it gets back. This service just forwards the prompt to Gemini and returns the
model's text, so it stays generic.

## Endpoints

- `GET  /health` — liveness + config check (never exposes the key)
- `POST /api/generate` — body `{ "prompt": "...", "maxTokens": 8000 }` → `{ "text": "..." }`

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit .env and paste your GEMINI_API_KEY

# load .env into the environment, then start the server
set -a && source .env && set +a
uvicorn main:app --reload --port 8000
```

Check it:

```bash
curl http://localhost:8000/health
```

Then point the Angular app at it by setting `NG_APP_API_BASE_URL=http://localhost:8000`
in the project's `.env.local` and running `npm start`.

## Deploy

This is a normal ASGI app — host it anywhere that runs Python or containers.
Set these environment variables on the host:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | your Gemini key (secret) |
| `GEMINI_MODEL` | `gemini-2.5-flash` (optional) |
| `FRONTEND_ORIGIN` | your Netlify URL, e.g. `https://your-site.netlify.app` (comma-separate to add localhost) |

**Render / Railway (no Docker):**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Docker (Cloud Run / Fly / anywhere):** a `Dockerfile` is included.

```bash
docker build -t resumecraft-backend ./backend
docker run -p 8000:8000 -e GEMINI_API_KEY=... resumecraft-backend
```

After deploy, set `NG_APP_API_BASE_URL` to the backend's public URL in Netlify's
environment variables and redeploy the frontend. When that variable is set, the
UI routes all AI calls through this backend (Gemini); when it is empty, it falls
back to the bring-your-own OpenAI/Anthropic key flow.
