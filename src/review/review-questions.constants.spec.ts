import { resolveAnswerOptionsPerQuestion } from './review-questions.constants';

describe('resolveAnswerOptionsPerQuestion', () => {
  it('returns three unique chips per question', () => {
    const rows = resolveAnswerOptionsPerQuestion(null, 3);
    expect(rows).toHaveLength(3);
    for (const chips of rows) {
      expect(chips).toHaveLength(3);
      expect(new Set(chips.map((c) => c.toLowerCase())).size).toBe(3);
    }
    expect(rows[0]).not.toEqual(rows[1]);
  });

  it('puts merchant keywords on the first question only', () => {
    const rows = resolveAnswerOptionsPerQuestion(['Biryani', 'friendly staff'], 3);
    expect(rows[0][0]).toBe('Biryani');
    expect(rows[1][0]).toBe('On time');
  });
});
