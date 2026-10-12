export const DEFAULT_REVIEW_QUESTIONS = [
  'What did you enjoy most about your visit?',
  'Was there anything that stood out? (staff, ambiance, service…)',
  'Who would you recommend us to?',
];

export const DEFAULT_ANSWER_OPTIONS = [
  'Friendly staff',
  'Great food',
  'Ambience',
  'Fast service',
  'Clean place',
  'Good value',
];

/** Quick-pick chips on the public review form; merchant keywords appear first. */
export function resolveAnswerOptions(keywords: string[] | null | undefined): string[] {
  const fromMerchant = (keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 12);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...fromMerchant, ...DEFAULT_ANSWER_OPTIONS]) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.slice(0, 14);
}

export function resolveReviewQuestions(custom: string[] | null | undefined): string[] {
  const fromSettings = (custom ?? []).map((q) => q.trim()).filter(Boolean).slice(0, 5);
  if (fromSettings.length) return fromSettings;
  return DEFAULT_REVIEW_QUESTIONS;
}

export type ReviewDraftAnswer = { question: string; answer: string };

export function normalizeDraftAnswers(
  questions: string[],
  answers: ReviewDraftAnswer[],
): ReviewDraftAnswer[] {
  const byQuestion = new Map<string, string>();
  for (const row of answers) {
    const q = row.question?.trim();
    const a = row.answer?.trim();
    if (!q || !a) continue;
    byQuestion.set(q, a.slice(0, 500));
  }
  const out: ReviewDraftAnswer[] = [];
  for (const question of questions) {
    const answer = byQuestion.get(question);
    if (answer) out.push({ question, answer });
  }
  for (const row of answers) {
    const q = row.question?.trim();
    const a = row.answer?.trim();
    if (!q || !a || questions.includes(q)) continue;
    out.push({ question: q.slice(0, 120), answer: a.slice(0, 500) });
  }
  return out.slice(0, 5);
}
