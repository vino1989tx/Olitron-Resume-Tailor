import { ResumeData, ResumeProject } from '../data/resume-data';

export const SUMMARY_SCOPE_ID = "summary";

export interface ResumeScope {
  id: string;
  label: string;
}

export function getAllScopes(resume: ResumeData): ResumeScope[] {
  const scopes: ResumeScope[] = [];
  if (resume.summary.length > 0) {
    scopes.push({ id: SUMMARY_SCOPE_ID, label: "Professional Summary" });
  }
  resume.experience.forEach((job) => {
    job.projects.forEach((project) => {
      scopes.push({
        id: project.id,
        label: `${job.company} — ${project.clientLabel}`,
      });
    });
  });
  return scopes;
}

export function findProject(resume: ResumeData, projectId: string): ResumeProject | null {
  for (const job of resume.experience) {
    const project = job.projects.find((p) => p.id === projectId);
    if (project) return project;
  }
  return null;
}

export function getScopeBullets(resume: ResumeData, scopeId: string): string[] | null {
  if (scopeId === SUMMARY_SCOPE_ID) return resume.summary;
  const project = findProject(resume, scopeId);
  return project ? project.bullets : null;
}

export function setScopeBullets(resume: ResumeData, scopeId: string, bullets: string[]): void {
  if (scopeId === SUMMARY_SCOPE_ID) {
    resume.summary = bullets;
    return;
  }
  const project = findProject(resume, scopeId);
  if (project) project.bullets = bullets;
}

export function getScopeLabel(resume: ResumeData, scopeId: string): string {
  if (scopeId === SUMMARY_SCOPE_ID) return "Professional Summary";
  const project = findProject(resume, scopeId);
  return project ? project.clientLabel : scopeId;
}
