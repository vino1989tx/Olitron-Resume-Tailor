import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.local');
const outputPath = resolve(root, 'src/environments/environment.generated.ts');
const values = {};

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

// In production we NEVER bake API keys into the shipped bundle — they would be
// readable by anyone. Keys are only embedded for local development; in prod the
// user supplies their own key at runtime (stored in their browser only).
const omitKeys =
  process.argv.includes('--prod') ||
  process.env['RESUME_TAILOR_OMIT_KEYS'] === 'true' ||
  process.env['NODE_ENV'] === 'production';

const stringValue = (key, fallback = '') => JSON.stringify(values[key] || fallback);
const numberValue = (key, fallback) => {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const keyValue = (key) => JSON.stringify(omitKeys ? '' : values[key] || '');

const source = `// Generated from .env.local. Do not edit manually.
// API keys are included only for local dev; production builds ship with empty keys.
export const environment = {
  anthropicApiKey: ${keyValue('NG_APP_ANTHROPIC_API_KEY')},
  openAiApiKey: ${keyValue('NG_APP_OPENAI_API_KEY')},
  openAiModel: ${stringValue('NG_APP_OPENAI_MODEL', 'gpt-4.1')},
  openAiParseModel: ${stringValue('NG_APP_OPENAI_PARSE_MODEL', 'gpt-4o-mini')},
  openAiInputPrice: ${numberValue('NG_APP_OPENAI_INPUT_PRICE', 2)},
  openAiCachedInputPrice: ${numberValue('NG_APP_OPENAI_CACHED_INPUT_PRICE', 0.5)},
  openAiOutputPrice: ${numberValue('NG_APP_OPENAI_OUTPUT_PRICE', 8)},
  initialCreditBalance: ${numberValue('NG_APP_CREDIT_BALANCE', 5)},
};
`;

writeFileSync(outputPath, source);
