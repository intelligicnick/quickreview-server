export const DEFAULT_REVIEW_QUESTIONS = [
  'What did you enjoy most about your visit?',
  'Was there anything that stood out? (staff, ambiance, service…)',
  'Who would you recommend us to?',
];

/** Three quick-pick chips per default question (enjoy / stood out / recommend). */
export const DEFAULT_ANSWER_OPTIONS_BY_QUESTION: readonly (readonly string[])[] = [
  ['Friendly staff', 'Great food', 'Ambience'],
  ['Fast service', 'Clean place', 'Good value'],
  ['Friends & family', 'Date night', 'Food lovers'],
];

const CHIPS_PER_QUESTION = 3;

function pickUniqueLabels(labels: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

/** Quick-pick chips aligned with each review question; Q1 prefers merchant keywords. */
export function resolveAnswerOptionsPerQuestion(
  keywords: string[] | null | undefined,
  questionCount: number,
): string[][] {
  const fromMerchant = (keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const templates = DEFAULT_ANSWER_OPTIONS_BY_QUESTION;
  const out: string[][] = [];
  for (let i = 0; i < questionCount; i++) {
    const defaults = templates[i] ?? templates[i % templates.length];
    const pool = i === 0 && fromMerchant.length ? [...fromMerchant, ...defaults] : [...defaults];
    out.push(pickUniqueLabels(pool, CHIPS_PER_QUESTION));
  }
  return out;
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
