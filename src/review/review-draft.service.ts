import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessCategory } from '../catalog/business-category.enum';
import { ERROR_CODES } from '../common/constants';
import { extractJsonArray, geminiGenerateText } from '../common/utils/gemini-client';
import { Location } from '../locations/location.entity';
import type { ReviewDraftAnswer } from './review-questions.constants';

export const REVIEW_FRAME_GENERATION_LIMIT = 2;
const FRAME_QUOTA_TTL_MS = 6 * 60 * 60 * 1000;

function businessTypeHint(category: BusinessCategory | null | undefined): string | null {
  if (!category) return null;
  switch (category) {
    case BusinessCategory.SERVICES:
      return 'Professional / B2B services — avoid food or “meal” language unless the customer mentioned it.';
    case BusinessCategory.RESTAURANT:
    case BusinessCategory.BAKERY:
      return 'Restaurant or café — food and dining context is appropriate when the customer mentioned it.';
    case BusinessCategory.BEAUTY:
      return 'Salon or beauty — focus on service results and hygiene when relevant.';
    default:
      return `Business type: ${category.replace(/_/g, ' ')}. Match the customer’s words, not a generic template.`;
  }
}

function pickOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const REVIEW_DRAFT_COUNT = 2;
const GEMINI_CANDIDATE_COUNT = 4;

const GENERIC_REVIEW_PHRASES = [
  'great service',
  'amazing experience',
  'highly recommend',
  'would recommend',
  'hidden gem',
  'top notch',
  'top-notch',
  'exceeded expectations',
  'five star',
  '5 star',
  '5-star',
  'friendly staff',
  'friendly team',
  'good experience',
  'made the visit worthwhile',
  'stood out',
  'without hassle',
  'earned my trust',
  'glad i stopped by',
  'easy to recommend',
  'would happily return',
  'would come back',
  'worth checking out',
  'pleasant experience',
  'wonderful experience',
  'excellent service',
  'outstanding service',
];

function splitAnswerPhrases(answers: ReviewDraftAnswer[]): string[] {
  const phrases: string[] = [];
  for (const row of answers) {
    for (const part of row.answer.split(/[,;]+/)) {
      const trimmed = part.trim();
      if (trimmed.length >= 2) phrases.push(trimmed);
    }
  }
  return phrases;
}

/** Concrete nouns/phrases from guest answers — drafts should echo these, not boilerplate. */
function customerLexicon(answers: ReviewDraftAnswer[], keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 3) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };
  for (const row of answers) {
    push(row.answer);
    for (const part of row.answer.split(/[,;]+/)) push(part);
    for (const word of row.answer.split(/\s+/)) {
      if (word.length >= 5) push(word);
    }
  }
  for (const kw of keywords) push(kw);
  return out.slice(0, 24);
}

function answerCorpus(answers: ReviewDraftAnswer[]): string {
  return answers.map((row) => row.answer).join(' ').toLowerCase();
}

function phraseAllowedInDraft(phrase: string, corpus: string): boolean {
  return corpus.includes(phrase.toLowerCase());
}

function draftSpecificityScore(
  draft: string,
  lexicon: string[],
  answerText: string,
  businessName: string,
): number {
  const lower = draft.toLowerCase();
  let score = 0;
  for (const term of lexicon) {
    const t = term.toLowerCase();
    if (t.length >= 4 && lower.includes(t)) score += 3;
  }
  for (const banned of GENERIC_REVIEW_PHRASES) {
    if (lower.includes(banned) && !phraseAllowedInDraft(banned, answerText)) score -= 4;
  }
  if (lower.includes(businessName.toLowerCase())) score += 1;
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length >= 18 && words.length <= 55) score += 2;
  if (words.length < 10) score -= 2;
  if (/\b(i|i'm|i've|we|we're)\b/.test(lower)) score += 1;
  return score;
}

function pickBestReviewDrafts(
  candidates: string[],
  count: number,
  lexicon: string[],
  answerText: string,
  businessName: string,
  excludeDrafts: string[],
): string[] {
  const fresh = filterExcluded(candidates, excludeDrafts);
  const pool = fresh.length >= 1 ? fresh : candidates;
  const ranked = [...pool].sort(
    (a, b) =>
      draftSpecificityScore(b, lexicon, answerText, businessName) -
      draftSpecificityScore(a, lexicon, answerText, businessName),
  );
  const diverse = selectDiverseDrafts(ranked, Math.min(count, ranked.length));
  const minScore = lexicon.length >= 2 ? 2 : 0;
  const ok = diverse.filter(
    (row) => draftSpecificityScore(row, lexicon, answerText, businessName) >= minScore,
  );
  return ok.length >= 1 ? selectDiverseDrafts(ok, count) : diverse.slice(0, count);
}

function significantWords(text: string): Set<string> {
  const stop = new Set([
    'about', 'after', 'again', 'also', 'been', 'from', 'have', 'just', 'more', 'much',
    'really', 'than', 'that', 'this', 'they', 'very', 'were', 'with', 'your', 'their',
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w)),
  );
}

function wordOverlapRatio(a: string, b: string): number {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

function normalizeDraftKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Pick drafts that share the fewest content words (avoids near-duplicate options). */
function selectDiverseDrafts(candidates: string[], count: number): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of candidates) {
    const trimmed = row.trim();
    const key = normalizeDraftKey(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  if (unique.length <= count) return unique.slice(0, count);

  const pool = shuffle(unique);
  const picked: string[] = [pool[0]!];
  while (picked.length < count) {
    let best: string | null = null;
    let bestOverlap = Infinity;
    for (const candidate of pool) {
      if (picked.includes(candidate)) continue;
      const overlap = Math.max(...picked.map((p) => wordOverlapRatio(p, candidate)));
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = candidate;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked.slice(0, count);
}

function filterExcluded(candidates: string[], excludeDrafts: string[]): string[] {
  if (!excludeDrafts.length) return candidates;
  const excludeKeys = new Set(excludeDrafts.map(normalizeDraftKey));
  return candidates.filter((row) => {
    const key = normalizeDraftKey(row);
    if (excludeKeys.has(key)) return false;
    return !excludeDrafts.some((prev) => wordOverlapRatio(prev, row) >= 0.72);
  });
}

@Injectable()
export class ReviewDraftService {
  private readonly logger = new Logger(ReviewDraftService.name);
  private readonly frameQuota = new Map<string, { count: number; at: number }>();

  constructor(private readonly config: ConfigService) {}

  assertFrameGenerationAllowed(code: string, sessionKey: string): void {
    const key = `${code}\0${sessionKey}`;
    const now = Date.now();
    const prev = this.frameQuota.get(key);
    if (!prev || now - prev.at > FRAME_QUOTA_TTL_MS) return;
    if (prev.count >= REVIEW_FRAME_GENERATION_LIMIT) {
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'You can frame your review up to 2 times. Pick one of the options above.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Call after a successful draft generation; returns how many more frames remain. */
  recordFrameGeneration(code: string, sessionKey: string): number {
    const key = `${code}\0${sessionKey}`;
    const now = Date.now();
    const prev = this.frameQuota.get(key);
    if (!prev || now - prev.at > FRAME_QUOTA_TTL_MS) {
      this.frameQuota.set(key, { count: 1, at: now });
      return REVIEW_FRAME_GENERATION_LIMIT - 1;
    }
    prev.count += 1;
    prev.at = now;
    return REVIEW_FRAME_GENERATION_LIMIT - prev.count;
  }

  async suggestDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    excludeDrafts: string[] = [],
  ): Promise<string[]> {
    const normalizedKeywords = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12);
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey !== 'mock') {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const fromGemini = await this.geminiDrafts(
            location,
            stars,
            normalizedKeywords,
            answers,
            apiKey,
            excludeDrafts,
            attempt > 0,
          );
          const lexicon = customerLexicon(answers, normalizedKeywords);
          const corpus = answerCorpus(answers);
          const fresh = filterExcluded(fromGemini, excludeDrafts);
          if (fresh.length >= 1) {
            const picked = pickBestReviewDrafts(
              fresh,
              REVIEW_DRAFT_COUNT,
              lexicon,
              corpus,
              location.name,
              excludeDrafts,
            );
            if (
              picked.length >= 1 &&
              (!lexicon.length ||
                picked.some((row) => draftSpecificityScore(row, lexicon, corpus, location.name) >= 2))
            ) {
              return picked;
            }
            if (attempt === 0) continue;
          }
        } catch (err) {
          this.logger.warn(`Gemini drafts attempt ${attempt + 1} failed: ${String(err)}`);
        }
      }
      this.logger.warn('Gemini drafts exhausted retries, using local fallback');
    }
    return this.templateDrafts(
      location.name,
      location.businessCategory,
      stars,
      normalizedKeywords,
      answers,
      excludeDrafts,
    );
  }

  private formatAnswers(answers: ReviewDraftAnswer[]): string {
    return answers.map((row) => `Q: ${row.question}\nA: ${row.answer}`).join('\n\n');
  }

  private templateDrafts(
    name: string,
    _category: BusinessCategory | null | undefined,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    excludeDrafts: string[],
  ): string[] {
    const lexicon = customerLexicon(answers, keywords);
    const corpus = answerCorpus(answers);
    const phrases = splitAnswerPhrases(answers);
    const a = phrases[0] ?? lexicon[0] ?? 'what I needed';
    const b = phrases[1] ?? phrases[0] ?? lexicon[1] ?? a;
    const c = phrases[2];
    const candidates = shuffle([
      c
        ? `I went to ${name} for ${a.toLowerCase()} — ${c} was the part I'll remember, and the rest matched the ${stars}-star vibe I was hoping for.`
        : `Stopped by ${name} after hearing about ${a.toLowerCase()}; ${b.toLowerCase()} was exactly on point.`,
      `Between ${a.toLowerCase()} and ${b.toLowerCase()}, ${name} delivered — I'm leaving this review so the next person knows what to expect.`,
      `If you care about ${b.toLowerCase()}, ${name} is worth a visit. ${a} sealed it for me.`,
    ]);
    const picked = pickBestReviewDrafts(
      candidates,
      REVIEW_DRAFT_COUNT,
      lexicon,
      corpus,
      name,
      excludeDrafts,
    );
    return picked.length >= 1 ? picked : selectDiverseDrafts(candidates, REVIEW_DRAFT_COUNT);
  }

  private async geminiDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    apiKey: string,
    excludeDrafts: string[],
    strictRetry: boolean,
  ): Promise<string[]> {
    const model =
      this.config.get<string>('GEMINI_REVIEW_MODEL') ??
      this.config.get<string>('GEMINI_MODEL') ??
      'gemini-2.0-flash';
    const lexicon = customerLexicon(answers, keywords);
    const angle = pickOne([
      'tell a mini story about one moment',
      'explain who this place is perfect for',
      'compare expectation vs what actually happened',
      'focus on one sensory or concrete detail',
      'sound like a busy local leaving a quick honest note',
    ]);
    const draftRules = [
      `Return ONLY a JSON array of exactly ${GEMINI_CANDIDATE_COUNT} strings, no markdown.`,
      'You write top Google reviews: specific, human, believable — never brochure or SEO copy.',
      'BAD (reject this style): "Great service and friendly staff. Highly recommend!"',
      'GOOD: "The paneer tikka was charred just right and they had our table ready before the kids got restless."',
      'Each draft MUST weave in at least TWO distinct details from the customer lexicon below (use their words or tight paraphrase).',
      'Each draft MUST mention the business name once.',
      `Match a ${stars}-star tone: enthusiastic but believable${stars === 4 ? ' (strong but not over-the-top)' : ''}.`,
      'Vary length: two drafts ~2–3 sentences; two drafts ~1–2 sentences.',
      'All four options must feel like different people — different openings and angles.',
      'Do NOT open with "I had a great experience" or "I recently visited".',
      `Do NOT use generic filler unless the customer literally said it: ${GENERIC_REVIEW_PHRASES.slice(0, 12).join(', ')}.`,
      'No hashtags, emojis, fake names, or invented discounts.',
      `Angle to explore across the set: ${angle}.`,
      `Freshness token: ${Date.now()}-${Math.floor(Math.random() * 10_000)}.`,
    ];
    if (strictRetry) {
      draftRules.push(
        'Last batch was too generic. Use sharper, more concrete wording and more of the customer lexicon.',
      );
    }
    if (excludeDrafts.length) {
      draftRules.push(
        'Never reuse or closely paraphrase these earlier drafts:',
        ...excludeDrafts.map((row, index) => `${index + 1}. ${row}`),
      );
    }

    const prompt = answers.length
      ? [
          `Write ${GEMINI_CANDIDATE_COUNT} publish-ready Google review options in first person.`,
          'Facts must come ONLY from customer answers — never invent staff, dishes, prices, or offers.',
          ...draftRules,
          `Business: ${location.name}`,
          location.address ? `Location context: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating selected: ${stars}/5`,
          lexicon.length ? `Customer lexicon (MUST appear across each draft): ${lexicon.join(' · ')}` : null,
          'Customer Q&A:',
          this.formatAnswers(answers),
          keywords.length
            ? `Merchant themes — only if the guest already hinted at them: ${keywords.join(', ')}`
            : null,
        ]
      : [
          `Write ${GEMINI_CANDIDATE_COUNT} publish-ready Google review options in first person.`,
          ...draftRules,
          `Business: ${location.name}`,
          location.address ? `Location context: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating: ${stars}/5`,
          keywords.length ? `Optional themes if natural: ${keywords.join(', ')}` : null,
        ];
    const promptText = prompt.filter(Boolean).join('\n');

    const text = await geminiGenerateText(apiKey, model, promptText, {
      temperature: strictRetry ? 0.92 : 0.88,
      maxOutputTokens: 2048,
      json: true,
    });

    const parsed = JSON.parse(extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
    const strings = parsed.filter(
      (row): row is string => typeof row === 'string' && row.trim().length > 8,
    );
    return strings;
  }
}
