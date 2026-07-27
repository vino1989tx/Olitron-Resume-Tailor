import { Injectable } from '@angular/core';
import { ResumeData } from '../data/resume-data';
import { callModel } from './ai-client';

@Injectable({
  providedIn: 'root',
})
export class ResumeParserService {
  /**
   * Parse extracted resume text into structured ResumeData using the AI backend.
   */
  async parseResumeText(extractedText: string): Promise<ResumeData> {
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text extracted from resume. Please ensure the file is readable.');
    }

    const prompt = this.buildParsingPrompt(extractedText);

    try {
      // Long resumes produce large JSON; keep headroom so the output is never
      // truncated mid-structure (which would drop trailing jobs/bullets).
      const result = await callModel(prompt, 16000);

      return this.validateAndStructureResponse(result);
    } catch (error) {
      throw new Error(
        `Failed to parse resume: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Build the AI prompt for resume parsing
   */
  private buildParsingPrompt(resumeText: string): string {
    return `You are an expert resume parser. Parse the following resume text and extract structured information matching this JSON schema.

IMPORTANT INSTRUCTIONS:
1. Extract ALL information from the resume text provided. COMPLETENESS IS CRITICAL:
   include EVERY job, EVERY client engagement, and EVERY bullet point. Do NOT
   summarize, skip, merge, or truncate any content — even if the resume is long.
2. Return ONLY valid JSON matching the exact schema below - no markdown, no explanations, no code fences
3. If a field is not found in the resume, use sensible defaults:
   - Empty strings for text fields
   - Empty arrays for arrays
   - Empty objects for skills array with label/items structure
4. For experience jobs, preserve the exact role, company, duration, and bullets from the resume
5. A SINGLE job/company often lists MULTIPLE client engagements under one role
   (e.g. "Info Services | Nov 2022 – Present" followed by sub-headers like
   "United Airlines: (Nov 2025 - Present)" and "Norwegian Cruise Line: (2022 - 2025)").
   For each such engagement, create a SEPARATE object in that job's "projects" array,
   with its own clientLabel, duration, and ALL of its bullets. Never drop or combine
   engagements — if a job shows two client sub-sections, the projects array MUST have
   two entries, each with the full bullet list for that client.
6. For skills, group by category (Programming Languages, Frameworks, Cloud, Databases, etc.)
7. For summary, parse into individual bullet points
8. Preserve phone, email, location, LinkedIn URL exactly as written

REQUIRED JSON SCHEMA:
{
  "name": "string - Full name",
  "title": "string - Job title or headline",
  "phone": "string - Phone number",
  "email": "string - Email address",
  "location": "string - Location",
  "linkedin": "string - LinkedIn profile URL",
  "summary": ["array of summary bullet points"],
  "skills": [
    {
      "label": "string - Skill category (e.g., 'Programming Languages')",
      "items": "comma-separated string of skills"
    }
  ],
  "experience": [
    {
      "role": "string - Job title",
      "company": "string - Company name",
      "duration": "string - Duration (e.g., '2020 - 2022')",
      "clientsLine": "string - Client line or empty string",
      "projects": [
        {
          "id": "string - Project identifier or number",
          "clientLabel": "string - Client name",
          "duration": "string - Project duration",
          "bullets": ["array of achievement bullets"]
        }
      ]
    }
  ],
  "education": "string - Education information"
}

RESUME TEXT TO PARSE:
${resumeText}

Return ONLY the JSON object, no markdown code fences, no explanations.`;
  }

  /**
   * Validate and structure the AI response
   */
  private validateAndStructureResponse(response: Record<string, unknown>): ResumeData {
    // Validate required fields
    const data = response as any;

    return {
      name: String(data.name || '').trim(),
      title: String(data.title || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      location: String(data.location || '').trim(),
      linkedin: String(data.linkedin || '').trim(),
      leftExtras: [],
      rightExtras: [],
      summary: Array.isArray(data.summary)
        ? data.summary.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0)
        : [],
      skills: this.validateSkills(data.skills),
      experience: this.assignUniqueProjectIds(this.validateExperience(data.experience)),
      education: String(data.education || '').trim(),
    };
  }

  /**
   * Guarantee every project has a globally unique id. The scope/tailoring system
   * (scopes.ts) locates projects by id across the whole resume, so ids that
   * repeat between jobs (e.g. two jobs each with "project-0") would collide and
   * cause the wrong section to be tailored.
   */
  private assignUniqueProjectIds(experience: any[]): any[] {
    let counter = 0;
    return experience.map((job: any) => ({
      ...job,
      projects: Array.isArray(job.projects)
        ? job.projects.map((project: any) => ({
            ...project,
            id: `project-${counter++}`,
          }))
        : [],
    }));
  }

  /**
   * Validate and structure skills array
   */
  private validateSkills(
    skills: unknown,
  ): Array<{ label: string; items: string }> {
    if (!Array.isArray(skills)) {
      return [];
    }

    return skills
      .map((skill: any) => ({
        label: String(skill.label || '').trim(),
        items: String(skill.items || '').trim(),
      }))
      .filter((s) => s.label.length > 0 && s.items.length > 0);
  }

  /**
   * Validate and structure experience array
   */
  private validateExperience(experience: unknown): any[] {
    if (!Array.isArray(experience)) {
      return [];
    }

    return experience
      .map((job: any) => ({
        role: String(job.role || '').trim(),
        company: String(job.company || '').trim(),
        duration: String(job.duration || '').trim(),
        clientsLine: String(job.clientsLine || '').trim(),
        projects: this.validateProjects(job.projects),
      }))
      .filter((j) => j.role.length > 0 || j.company.length > 0);
  }

  /**
   * Validate and structure projects array
   */
  private validateProjects(projects: unknown): any[] {
    if (!Array.isArray(projects)) {
      return [];
    }

    return projects
      .map((proj: any, idx: number) => ({
        id: String(proj.id || `project-${idx}`).trim(),
        clientLabel: String(proj.clientLabel || '').trim(),
        duration: String(proj.duration || '').trim(),
        bullets: Array.isArray(proj.bullets)
          ? proj.bullets.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0)
          : [],
      }))
      .filter((p) => p.clientLabel.length > 0 || p.bullets.length > 0);
  }
}
