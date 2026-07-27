import { environment } from '../../environments/environment.generated';
import { ResumeData } from '../data/resume-data';

const MAX_JOB_DESCRIPTION_CHARACTERS = 12_000;
const MAX_GLOBAL_INSTRUCTION_CHARACTERS = 4_000;

function compactInput(value: string, maximumCharacters: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maximumCharacters);
}

function tailoredOutputTokenBudget(bulletCount: number): number {
  return Math.min(2_500, Math.max(500, bulletCount * 110));
}

export function extractJsonObject(text: unknown): Record<string, unknown> {
  if (typeof text !== "string") {
    throw new Error("AI service returned no text content.");
  }

  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON in the AI response.");
  }

  return JSON.parse(jsonMatch[0]);
}

function readGoogleIdToken(): string {
  try {
    return globalThis.sessionStorage?.getItem("googleIdToken") || "";
  } catch {
    return "";
  }
}

/**
 * The single AI entry point: POST the prompt to our backend, which holds the
 * Gemini key server-side, enforces the signed-in user's quota, and returns the
 * model's JSON text. No API key ever exists in the browser.
 */
export async function callModel(prompt: string, maxTokens: number): Promise<Record<string, unknown>> {
  const baseUrl = (environment.apiBaseUrl || "").trim();
  if (!baseUrl) {
    throw new Error("AI service is not configured. Set NG_APP_API_BASE_URL to the backend URL.");
  }

  const idToken = readGoogleIdToken();
  if (!idToken) {
    throw new Error("Please sign in with Google to continue.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => null)) as { detail?: string } | null;
    const message = errBody?.detail || `AI request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Backend returns { text, usage }; the resume logic only needs the JSON text.
  const data = (await response.json()) as { text?: string };
  return extractJsonObject(data.text);
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

export async function tailorBullets({
  clientLabel,
  currentBullets,
  jobDescription,
}: {
  clientLabel: string;
  currentBullets: string[];
  jobDescription: string;
}): Promise<string[]> {
  const prompt = buildPrompt(clientLabel, currentBullets, jobDescription);
  const parsed = await callModel(prompt, tailoredOutputTokenBudget(currentBullets.length));

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

  // Tolerate older response shapes while retaining all omitted base-resume bullets.
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
    throw new Error("The AI response was not a valid resume object.");
  }
  const resume = candidate as Record<string, unknown>;
  const requiredStrings: Array<keyof ResumeData> = ["name", "title", "phone", "email", "location", "linkedin", "education"];
  for (const key of requiredStrings) {
    if (typeof resume[key] !== "string") {
      throw new Error(`The AI response is missing or corrupted the "${key}" field.`);
    }
  }
  if (!Array.isArray(resume['summary']) || resume['summary'].length === 0) {
    throw new Error("The AI response is missing the professional summary.");
  }
  if (resume['summary'].length !== original.summary.length) {
    throw new Error("The AI changed the number of summary bullets — rejecting to avoid losing existing points.");
  }
  if (!Array.isArray(resume['skills']) || resume['skills'].some((skill: { label?: string; items?: string }) => !skill.label || !skill.items)) {
    throw new Error("The AI response is missing or corrupted the skills table.");
  }
  if (!Array.isArray(resume['experience']) || resume['experience'].length !== original.experience.length) {
    throw new Error("The AI response changed the number of jobs — rejecting to avoid data loss.");
  }
  for (let i = 0; i < original.experience.length; i++) {
    const origJob = original.experience[i];
    const newJob = resume['experience'][i] as ResumeData['experience'][number] | undefined;
    if (!newJob || !Array.isArray(newJob.projects) || newJob.projects.length !== origJob.projects.length) {
      throw new Error("The AI response changed the number of client/projects — rejecting to avoid data loss.");
    }
    for (let j = 0; j < origJob.projects.length; j++) {
      if (newJob.projects[j]?.id !== origJob.projects[j].id) {
        throw new Error("The AI response changed a project ID — rejecting to avoid data loss.");
      }
      if (!Array.isArray(newJob.projects[j].bullets) || newJob.projects[j].bullets.length === 0) {
        throw new Error("The AI response left a project with no bullets — rejecting.");
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

export async function applyGlobalChanges({
  resume,
  instructions,
}: {
  resume: ResumeData;
  instructions: string;
}): Promise<ResumeData> {
  const prompt = buildGlobalChangePrompt(resume, instructions);
  const parsed = await callModel(prompt, 8000);
  preserveBulletCounts(parsed, resume);
  validateResumeShape(parsed, resume);
  return parsed;
}
