# Olitron ResumeCraft

An Angular app for editing, AI-tailoring, previewing, and exporting a resume
(ATS-optimized). Upload a PDF/DOCX, tailor it to a job description, and download
as PDF or Word.

## Development

1. Add your API key to `.env.local` (this file is git-ignored):

   ```text
   NG_APP_OPENAI_API_KEY=sk-...
   # optional: NG_APP_ANTHROPIC_API_KEY=sk-ant-...
   # optional overrides:
   # NG_APP_OPENAI_MODEL=gpt-4.1            (tailoring model)
   # NG_APP_OPENAI_PARSE_MODEL=gpt-4o-mini  (fast/cheap upload-parse model)
   ```

2. Install and run:

   ```bash
   npm install
   npm start
   ```

3. Open `http://localhost:4200`.

## API keys & security

- **Local dev** (`npm start`): the key from `.env.local` is baked into the dev
  build for convenience.
- **Production** (`npm run build`): **no API key is baked into the bundle.** The
  build always ships with empty keys, so your key can never leak to end users.
  In production, each user supplies **their own** OpenAI/Anthropic key via
  **Resume → Upload Resume → Configure API Keys**; it's stored only in that
  user's browser session and sent directly to the AI provider (never to us).

  > If you ever want to serve AI calls with a shared key, put it behind a small
  > backend proxy — never in the client bundle.

## Commands

- `npm start` — dev server (bakes the local key)
- `npm run build` — **production** build (keys stripped)
- `npm run build:dev` — development-configuration build (keeps the local key)
- `npm test` — run unit tests
