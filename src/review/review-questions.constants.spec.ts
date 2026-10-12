import { resolveAnswerOptions } from './review-questions.constants';

describe('resolveAnswerOptions', () => {
  it('merges merchant keywords with defaults without duplicates', () => {
    const options = resolveAnswerOptions(['Biryani', 'friendly staff']);
    expect(options[0]).toBe('Biryani');
    expect(options).toContain('Ambience');
    expect(options.filter((o) => o.toLowerCase() === 'friendly staff')).toHaveLength(1);
  });
});
