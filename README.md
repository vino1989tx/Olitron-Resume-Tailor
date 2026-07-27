# Olitron ResumeCraft

An Angular app for editing, AI-tailoring, previewing, and exporting a resume
(ATS-optimized). Upload a PDF/DOCX, tailor it to a job description, and download
as PDF or Word.

The frontend holds **no API keys**. Users sign in with **Google**, and all AI
runs on a separate backend (FastAPI + Gemini) that holds the key server-side and
enforces a per-user token quota. See the backend repo for that service.

## Development

1. Create `.env.local` (git-ignored) pointing at your backend + Google client id:

   ```text
   NG_APP_API_BASE_URL=http://localhost:8000
   NG_APP_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

2. Install and run:

   ```bash
   npm install
   npm start
   ```

3. Open `http://localhost:4200`. You'll be asked to sign in with Google.

## How auth + AI work

- **Google sign-in** gates the whole app. The browser gets a Google ID token.
- Every AI action (upload-parse, tailor, common-changes) POSTs the prompt to
  `NG_APP_API_BASE_URL` with that token in the `Authorization` header.
- The backend verifies the token, checks the user's token quota, calls Gemini,
  records usage, and returns the result. **No provider key is ever in the browser.**

Both env values are public (a backend URL and an OAuth client id), so production
builds are safe — there are no secrets to strip.

## Deploy (Netlify)

`netlify.toml` sets the build command (`npm run build`) and publish directory
(`dist/resume-tailor/browser`). Set `NG_APP_API_BASE_URL` and
`NG_APP_GOOGLE_CLIENT_ID` in Netlify's environment variables, then deploy.

## Commands

- `npm start` — dev server
- `npm run build` — production build
- `npm test` — run unit tests
