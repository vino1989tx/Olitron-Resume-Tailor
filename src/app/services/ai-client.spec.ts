import { extractJsonObject } from './ai-client';

describe('AI client utilities', () => {
  it('extracts JSON from model output', () => {
    expect(extractJsonObject('Answer: {"updatedBullets":["A"]}')).toEqual({
      updatedBullets: ['A'],
    });
  });

  it('extracts JSON from fenced model output', () => {
    expect(extractJsonObject('```json\n{"client":"Acme","updates":[]}\n```')).toEqual({
      client: 'Acme',
      updates: [],
    });
  });

  it('throws when there is no JSON object', () => {
    expect(() => extractJsonObject('no json here')).toThrowError();
  });
});
