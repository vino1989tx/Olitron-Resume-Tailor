import {
  calculateOpenAICost,
  extractJsonObject,
  isLowCreditError,
} from './ai-client';

describe('AI client utilities', () => {
  it('calculates OpenAI cost from uncached, cached, and output tokens', () => {
    const cost = calculateOpenAICost({
      prompt_tokens: 1_000_000,
      prompt_tokens_details: { cached_tokens: 200_000 },
      completion_tokens: 100_000,
    });

    expect(cost).toBe(2.5);
  });

  it('detects low-credit errors', () => {
    expect(isLowCreditError('Your credit balance is too low to access the API.')).toBeTrue();
  });

  it('extracts JSON from model output', () => {
    expect(extractJsonObject('Answer: {"updatedBullets":["A"]}')).toEqual({
      updatedBullets: ['A'],
    });
  });
});
