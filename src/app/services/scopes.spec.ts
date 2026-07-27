import { initialResumeData } from '../data/resume-data';
import { getAllScopes, getScopeBullets, SUMMARY_SCOPE_ID } from './scopes';

describe('resume scopes', () => {
  it('includes the summary and every project', () => {
    const expectedProjectCount = initialResumeData.experience.reduce(
      (count, job) => count + job.projects.length,
      0,
    );
    expect(getAllScopes(initialResumeData).length).toBe(expectedProjectCount + 1);
  });

  it('returns summary bullets', () => {
    expect(getScopeBullets(initialResumeData, SUMMARY_SCOPE_ID)).toBe(initialResumeData.summary);
  });
});
