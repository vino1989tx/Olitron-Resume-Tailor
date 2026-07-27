import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.local');
const outputPath = resolve(root, 'src/environments/environment.generated.ts');
const values = {};

// Seed from the process environment so CI/hosts (e.g. Netlify) can supply the
// NG_APP_* config as build env vars — there is no .env.local file there.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('NG_APP_') && value) values[key] = value;
}

// .env.local (local dev) overrides the process env when present.
try {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
} catch {
  // Local environment configuration is optional.
}

const stringValue = (key, fallback = '') => JSON.stringify(values[key] || fallback);

// The frontend holds NO secrets: all AI runs on the backend behind Google login.
// Both values below are public (a backend URL and an OAuth client id).
const source = `// Generated from .env.local. Do not edit manually.
// The frontend contains no secrets — AI runs server-side behind Google sign-in.
export const environment = {
  // Base URL of the managed AI backend (FastAPI + Gemini). All AI calls route
  // through it; the browser never holds a provider key.
  apiBaseUrl: ${stringValue('NG_APP_API_BASE_URL', '')},
  // Google OAuth 2.0 Web Client ID. The whole app requires Google sign-in when set.
  googleClientId: ${stringValue('NG_APP_GOOGLE_CLIENT_ID', '')},
};
`;

// The output directory is git-ignored (it only holds the generated file), so it
// may not exist on a fresh clone (e.g. CI/Netlify). Create it before writing.
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source);
