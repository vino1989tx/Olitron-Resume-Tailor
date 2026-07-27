import { environment } from '../../environments/environment.generated';
import { ResumeData } from '../data/resume-data';

const ANTHROPIC_MODEL = "claude-opus-4-8";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = environment.openAiModel;
const OPENAI_INPUT_PRICE_PER_MILLION = environment.openAiInputPrice;
const OPENAI_CACHED_INPUT_PRICE_PER_MILLION = environment.openAiCachedInputPrice;
const OPENAI_OUTPUT_PRICE_PER_MILLION = environment.openAiOutputPrice;
const MAX_JOB_DESCRIPTION_CHARACTERS = 12_000;
const MAX_GLOBAL_INSTRUCTION_CHARACTERS = 4_000;

export interface ApiKeys {
  anthropic: string;
  openai: string;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens?: number;
  estimatedCost?: number;
}

type UsageHandler = (usage: OpenAiUsage & { estimatedCost: number }) => void;

function compactInput(value: string, maximumCharacters: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maximumCharacters);
}

function tailoredOutputTokenBudget(bulletCount: number): number {
  return Math.min(2_500, Math.max(500, bulletCount * 110));
}

// User-supplied keys entered at runtime (production, where no key is baked in).
// Stored only in the browser session — never sent anywhere but the AI provider.
function readStoredApiKeys(): Partial<ApiKeys> {
  try {
    const raw = globalThis.sessionStorage?.getItem('apiKeys');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ApiKeys>;
      return { anthropic: parsed.anthropic, openai: parsed.openai };
    }
  } catch {
    // ignore malformed storage
  }
  return {};
}

export function resolveApiKeys(): ApiKeys {
  const stored = readStoredApiKeys();
  // Prefer a baked key (local dev); otherwise use the key the user entered (prod).
  return {
    anthropic: (environment.anthropicApiKey || stored.anthropic || '').trim(),
    openai: (environment.openAiApiKey || stored.openai || '').trim(),
  };
}

function getApiKeyValue(apiKey: ApiKeys | string, provider: 'anthropic' | 'openai'): string {
  if (typeof apiKey === "string") {
    return provider === "openai" ? "" : apiKey;
  }

  return provider === "openai" ? apiKey?.openai || "" : apiKey?.anthropic || "";
}

export function isLowCreditError(message: unknown): boolean {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("credit balance is too low") ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("credit") && normalized.includes("low") ||
    normalized.includes("billing") ||
    normalized.includes("quota") ||
    normalized.includes("overloaded") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  );
}

export function extractJsonObject(text: unknown): Record<string, unknown> {
  if (typeof text !== "string") {
    throw new Error("Model returned no text content.");
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON in the model response.");
  }

  return JSON.parse(jsonMatch[0]);
}

async function callAnthropic(
  apiKey: string,
  prompt: string,
  maxTokens = 4096,
  model = ANTHROPIC_MODEL,
): Promise<Record<string, unknown>> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = errBody?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json() as { content?: Array<{ type: string; text: string }> };
  const textBlock = data.content?.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Anthropic returned no text content.");
  }

  return extractJsonObject(textBlock.text);
}

export function calculateOpenAICost(usage: OpenAiUsage = {}): number {
  const inputTokens = usage.prompt_tokens || 0;
  const cachedInputTokens = usage.prompt_tokens_details?.cached_tokens || 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = usage.completion_tokens || 0;

  return (
    uncachedInputTokens * OPENAI_INPUT_PRICE_PER_MILLION +
    cachedInputTokens * OPENAI_CACHED_INPUT_PRICE_PER_MILLION +
    outputTokens * OPENAI_OUTPUT_PRICE_PER_MILLION
  ) / 1_000_000;
}

async function callOpenAI(
  apiKey: string,
  prompt: string,
  maxTokens = 4096,
  onUsage?: UsageHandler,
  model = OPENAI_MODEL,
): Promise<Record<string, unknown>> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = errBody?.error?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json() as {
    usage?: OpenAiUsage;
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (data.usage && onUsage) {
    onUsage({ ...data.usage, estimatedCost: calculateOpenAICost(data.usage) });
  }
  const content = data.choices?.[0]?.message?.content;
  return extractJsonObject(content);
}

export async function callModelWithFallback({
  apiKey,
  prompt,
  maxTokens = 4096,
  onUsage,
  openAiModel,
  anthropicModel,
}: {
  apiKey: ApiKeys | string;
  prompt: string;
  maxTokens?: number;
  onUsage?: UsageHandler;
  // Optional per-call model overrides. Used so the upload-parse step can run on
  // a faster/cheaper model than the tailoring step.
  openAiModel?: string;
  anthropicModel?: string;
}): Promise<Record<string, unknown>> {
  const anthropicKey = getApiKeyValue(apiKey, "anthropic");
  const openAiKey = getApiKeyValue(apiKey, "openai");

  if (openAiKey) {
    return await callOpenAI(openAiKey, prompt, maxTokens, onUsage, openAiModel || OPENAI_MODEL);
  }

  if (anthropicKey) {
    try {
      return await callAnthropic(anthropicKey, prompt, maxTokens, anthropicModel || ANTHROPIC_MODEL);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (isLowCreditError(message)) {
        throw new Error("Anthropic failed due to billing or quota issues. Configure an OpenAI/ChatGPT key to continue.");
      }
      throw error;
    }
  }

  throw new Error("No AI API key configured. Set NG_APP_OPENAI_API_KEY or NG_APP_ANTHROPIC_API_KEY.");
}

export function buildPrompt(clientLabel: string, currentBullets: string[], jobDescription: string): string {
  const experienceBlock = currentBullets.map((b) => `- ${b}`).join("\n");
  const minimumUpdateCount = Math.min(
    currentBullets.length,
    Math.max(3, Math.ceil(currentBullets.length * 0.7)),
  );
  const compactJobDescription = compactInput(
    jobDescription,
    MAX_JOB_DESCRIPTION_CHARACTERS,
  );

  return `You are an expert Technical Resume Writer, Senior Hiring Manager, and ATS Optimization Specialist.

Your goal is to tailor ONLY the selected client's/project's experience section to maximize the chances of getting interview calls for the provided job description.

## Primary Objective

Rewrite the selected experience so it closely aligns with the job description while maintaining a professional, believable, and ATS-friendly resume.

## Instructions

* Rewrite ONLY the selected client's/project's experience.
* Do NOT modify any other client, company, education, certifications, summary, skills, or personal information.
* Preserve the existing resume structure and formatting.
* Preserve the complete selected section and its current number and order of bullets.
* Update at least ${minimumUpdateCount} of the ${currentBullets.length} bullets. The "updates" array MUST contain at least ${minimumUpdateCount} unique valid indices.
* Substantially rewrite strong matches using important ATS keywords, technologies, responsibilities, and qualifications from the job description.
* Lightly polish bullets with similar or transferable responsibilities so their language better supports the target role.
* Update all bullets that can reasonably strengthen the candidate's match; do not stop after finding only one or two obvious matches.
* Leave a bullet unchanged only when it is genuinely unrelated and cannot be credibly connected to the target role.
* Return each changed bullet with its zero-based index from the Current Experience list.
* Keep bullet points concise, impactful, and achievement-oriented.
* Start bullets with strong action verbs.
* Optimize for ATS keyword matching.

## Technology Matching

When the job description contains technologies, frameworks, cloud platforms, databases, tools, methodologies, or architectural patterns:

* Incorporate named technologies required by the job description even when they are not present in the current resume.
* Add each requested technology naturally to the closest relevant existing responsibility or transferable skill.
* You may replace an existing technology with a target technology when both serve a comparable engineering purpose, or mention both when that reads naturally.
* You may add supporting technologies that are commonly and plausibly used with the requested stack.
* Prioritize technologies that improve ATS matching.
* When the requested technology differs from the current stack, connect it to a comparable existing responsibility such as front-end development, cloud services, databases, CI/CD, state management, testing, or API development.

## Transferable Skills

If the candidate does not explicitly mention a required technology but has closely related experience:

* Adapt the bullet to emphasize transferable experience.
* Update the closest relevant existing bullet while preserving all unrelated project details.
* Do not create unrealistic achievements.
* Avoid claiming expert-level ownership of technologies that would be implausible.
* If the target role is in an unrelated domain (for example aerospace, medicine, or law), do not claim work in that domain. Highlight only genuine transferable software-engineering skills.

## Bullet Style

Each bullet should:

* Begin with a strong action verb.
* Describe the responsibility or achievement.
* Mention relevant technologies.
* Highlight business value, scalability, performance, security, automation, maintainability, or user impact whenever applicable.

## Important Constraints

* Preserve dates, company names, client names, job titles, and duration.
* Do not change project domains.
* Technologies requested by the job description may be added even when absent from the current resume, but companies, projects, industries, responsibilities, and accomplishments must remain grounded in the current resume.
* Never claim employment, projects, systems, missions, clearances, or domain experience involving NASA, aerospace, rockets, spacecraft, defense, or any other target organization unless explicitly present in the current resume.
* Do not invent metrics, achievements, or technical experience.
* Do not claim certifications.
* Proofread every bullet. Preserve exact product and technology spelling, including .NET, APIs, OAuth 2.0, UI, AI, OpenAI, Vue.js, and Azure.
* Every bullet must be a complete grammatical sentence with no fragments, duplicated text, missing words, or truncated endings.
* Return plain text inside JSON strings; do not insert bullet symbols, headings, or section names inside a bullet.
* Do not mention that AI generated the content.
* Do not provide explanations or reasoning.

## Inputs

Selected Client:
${clientLabel}

Current Experience:
${experienceBlock}

Job Description:
${compactJobDescription}

## Output

Return only valid JSON, no markdown code fences, no commentary.

{
"client": "${clientLabel}",
"updates": [
  {
    "index": 0,
    "bullet": "Complete rewritten bullet for the existing bullet at index 0."
  },
  {
    "index": 1,
    "bullet": "Complete polished bullet for the existing bullet at index 1."
  }
]
}`;
}

export async function tailorBulletsWithClaude({
  apiKey,
  clientLabel,
  currentBullets,
  jobDescription,
  onUsage,
}: {
  apiKey: ApiKeys;
  clientLabel: string;
  currentBullets: string[];
  jobDescription: string;
  onUsage?: UsageHandler;
}): Promise<string[]> {
  const prompt = buildPrompt(clientLabel, currentBullets, jobDescription);
  const parsed = await callModelWithFallback({
    apiKey,
    prompt,
    maxTokens: tailoredOutputTokenBudget(currentBullets.length),
    onUsage,
  });

  const mergedBullets = [...currentBullets];
  const indexedUpdates = parsed['updates'];

  if (Array.isArray(indexedUpdates)) {
    let appliedUpdates = 0;
    for (const update of indexedUpdates) {
      if (!update || typeof update !== 'object') continue;
      const candidate = update as { index?: unknown; bullet?: unknown };
      if (
        Number.isInteger(candidate.index) &&
        (candidate.index as number) >= 0 &&
        (candidate.index as number) < mergedBullets.length &&
        typeof candidate.bullet === 'string' &&
        candidate.bullet.trim()
      ) {
        mergedBullets[candidate.index as number] = candidate.bullet.trim();
        appliedUpdates += 1;
      }
    }
    if (appliedUpdates > 0) return mergedBullets;
  }

  // Tolerate older model responses while retaining all omitted base-resume bullets.
  const legacyBullets = parsed['updatedBullets'];
  if (Array.isArray(legacyBullets)) {
    legacyBullets.forEach((bullet, index) => {
      if (index < mergedBullets.length && typeof bullet === 'string' && bullet.trim()) {
        mergedBullets[index] = bullet.trim();
      }
    });
    if (legacyBullets.length > 0) return mergedBullets;
  }

  throw new Error('The AI response did not contain any valid indexed bullet updates.');
}

function buildGlobalChangePrompt(resume: ResumeData, instructions: string): string {
  const compactInstructions = compactInput(
    instructions,
    MAX_GLOBAL_INSTRUCTION_CHARACTERS,
  );
  return `You are an expert Technical Resume Writer and ATS Optimization Specialist.

You will receive a full resume as JSON, and a description of one or more general changes the user wants applied. The change(s) may be relevant to ANY part of the resume — the header/contact info, the professional summary, the skills table, any bullet in any job/client/project, or education. Apply the requested change(s) everywhere in the document they are applicable.

## Instructions

* Apply the requested change(s) wherever in the resume they are relevant. Do not limit yourself to one section unless the instructions only apply to one section.
* Do NOT make any other changes beyond what is requested. Leave everything else exactly as it was.
* When tailoring toward a job description, rewrite existing points while preserving each point's underlying responsibility, array position, and project context.
* Preserve the number and order of summary bullets and every project's experience bullets.
* Add named technologies required by the requested role or job description even when they are absent from the current resume.
* Integrate each new technology into the closest plausible existing responsibility or transferable skill. Comparable areas include front-end frameworks, cloud services, relational databases, API development, state management, testing, and CI/CD pipelines.
* Preserve the exact JSON structure and all field names shown below.
* Preserve every "id" value inside "experience[].projects[]" EXACTLY as given — do not change, remove, reorder, add, or drop any project or job entry.
* Keep the same number of "experience" entries and the same number of "projects" within each, in the same order.
* Treat requests such as "make this a NASA rocket engineer resume" as a request to emphasize genuinely transferable engineering skills—not permission to invent aerospace, rocket, spacecraft, defense, mission, clearance, employer, or project experience.
* Technologies requested by the user or job description may be added; industries, responsibilities, employers, projects, accomplishments, and certifications must remain grounded in the current resume.
* Do not invent metrics, accomplishments, domain experience, employers, projects, or certifications.
* Proofread all changed text. Preserve exact spelling for .NET, APIs, OAuth 2.0, UI, AI, OpenAI, Vue.js, Azure, and other named technologies.
* Every summary and experience bullet must be a complete grammatical sentence with no fragments, duplicated phrases, missing words, or truncated endings.
* Preserve each array item as one clean plain-text bullet without embedded bullet symbols or headings.
* Do not mention that AI generated the content.
* Do not provide explanations, commentary, or markdown code fences.

## Current Resume (JSON)

${JSON.stringify(resume)}

## Requested Change(s)

${compactInstructions}

## Output

Return ONLY the complete updated resume as valid JSON, matching this exact shape (same top-level and nested field names as the input above). No commentary, no markdown fences.`;
}

function validateResumeShape(candidate: unknown, original: ResumeData): asserts candidate is ResumeData {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Claude's response was not a valid resume object.");
  }
  const resume = candidate as Record<string, unknown>;
  const requiredStrings: Array<keyof ResumeData> = ["name", "title", "phone", "email", "location", "linkedin", "education"];
  for (const key of requiredStrings) {
    if (typeof resume[key] !== "string") {
      throw new Error(`Claude's response is missing or corrupted the "${key}" field.`);
    }
  }
  if (!Array.isArray(resume['summary']) || resume['summary'].length === 0) {
    throw new Error("Claude's response is missing the professional summary.");
  }
  if (resume['summary'].length !== original.summary.length) {
    throw new Error("The AI changed the number of summary bullets — rejecting to avoid losing existing points.");
  }
  if (!Array.isArray(resume['skills']) || resume['skills'].some((skill: { label?: string; items?: string }) => !skill.label || !skill.items)) {
    throw new Error("Claude's response is missing or corrupted the skills table.");
  }
  if (!Array.isArray(resume['experience']) || resume['experience'].length !== original.experience.length) {
    throw new Error("Claude's response changed the number of jobs — rejecting to avoid data loss.");
  }
  for (let i = 0; i < original.experience.length; i++) {
    const origJob = original.experience[i];
    const newJob = resume['experience'][i] as ResumeData['experience'][number] | undefined;
    if (!newJob || !Array.isArray(newJob.projects) || newJob.projects.length !== origJob.projects.length) {
      throw new Error("Claude's response changed the number of client/projects — rejecting to avoid data loss.");
    }
    for (let j = 0; j < origJob.projects.length; j++) {
      if (newJob.projects[j]?.id !== origJob.projects[j].id) {
        throw new Error("Claude's response changed a project ID — rejecting to avoid data loss.");
      }
      if (!Array.isArray(newJob.projects[j].bullets) || newJob.projects[j].bullets.length === 0) {
        throw new Error("Claude's response left a project with no bullets — rejecting.");
      }
      if (newJob.projects[j].bullets.length !== origJob.projects[j].bullets.length) {
        throw new Error(
          "The AI changed the number of project bullets — rejecting to preserve every existing point.",
        );
      }
    }
  }
}

function preserveBulletCounts(candidate: unknown, original: ResumeData): void {
  if (!candidate || typeof candidate !== 'object') return;
  const updated = candidate as Partial<ResumeData>;

  if (Array.isArray(updated.summary)) {
    updated.summary = original.summary.map((originalBullet, index) => {
      const returnedBullet = updated.summary?.[index];
      return typeof returnedBullet === 'string' && returnedBullet.trim()
        ? returnedBullet.trim()
        : originalBullet;
    });
  }

  if (!Array.isArray(updated.experience)) return;
  updated.experience.forEach((job, jobIndex) => {
    const originalJob = original.experience[jobIndex];
    if (!originalJob || !Array.isArray(job?.projects)) return;
    job.projects.forEach((project, projectIndex) => {
      const originalProject = originalJob.projects[projectIndex];
      if (!originalProject || !Array.isArray(project?.bullets)) return;
      project.bullets = originalProject.bullets.map((originalBullet, bulletIndex) => {
        const returnedBullet = project.bullets[bulletIndex];
        return typeof returnedBullet === 'string' && returnedBullet.trim()
          ? returnedBullet.trim()
          : originalBullet;
      });
    });
  });
}

export async function applyGlobalChangesWithClaude({
  apiKey,
  resume,
  instructions,
  onUsage,
}: {
  apiKey: ApiKeys;
  resume: ResumeData;
  instructions: string;
  onUsage?: UsageHandler;
}): Promise<ResumeData> {
  const prompt = buildGlobalChangePrompt(resume, instructions);
  const parsed = await callModelWithFallback({ apiKey, prompt, maxTokens: 8000, onUsage });
  preserveBulletCounts(parsed, resume);
  validateResumeShape(parsed, resume);
  return parsed;
}
