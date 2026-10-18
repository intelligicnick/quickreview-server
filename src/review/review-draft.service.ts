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
          const fresh = filterExcluded(fromGemini, excludeDrafts);
          if (fresh.length >= 1) {
            return selectDiverseDrafts(fresh, REVIEW_DRAFT_COUNT);
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
    category: BusinessCategory | null | undefined,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    excludeDrafts: string[],
  ): string[] {
    const phrases = splitAnswerPhrases(answers);
    const theme = pickOne(keywords) ?? pickOne(phrases) ?? 'great service';
    const parts = phrases.length ? phrases : [theme];
    const at = category === BusinessCategory.SERVICES ? 'working with' : 'at';
    const leads = shuffle([
      `I rated ${name} ${stars}/5 because`,
      `My visit ${at} ${name} stood out —`,
      `${stars} stars ${at} ${name}:`,
      `Genuinely happy ${at} ${name}:`,
    ]);
    const mids = shuffle(parts);
    const tails = shuffle([
      'Would happily return.',
      'Glad I stopped by.',
      'Easy to recommend.',
      'They earned my trust.',
    ]);
    const candidates: string[] = [];
    for (let i = 0; i < Math.min(4, leads.length); i++) {
      const lead = leads[i]!;
      const mid = mids[i % mids.length]!;
      const tail = tails[i % tails.length]!;
      candidates.push(`${lead} ${mid.charAt(0).toLowerCase()}${mid.slice(1)}. ${tail}`);
    }
    const fresh = filterExcluded(candidates, excludeDrafts);
    const pool = fresh.length >= 1 ? fresh : candidates;
    return selectDiverseDrafts(pool, REVIEW_DRAFT_COUNT);
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
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const angle = pickOne([
      'warm thank-you',
      'specific detail highlight',
      'recommendation to a friend',
      'brief and punchy',
      'first-time visitor impressed',
    ]);
    const draftRules = [
      `Return ONLY a JSON array of exactly ${REVIEW_DRAFT_COUNT} strings, no markdown.`,
      'Write 1–2 natural sentences per draft (real Google review tone).',
      'The two drafts must feel like different people wrote them — different opening, angle, and length.',
      'Do NOT repeat the same phrases, adjectives, or key nouns across both drafts.',
      'Do NOT dump every customer bullet into each draft — highlight at most two ideas per draft.',
      'Prefer vivid, specific wording over stacking comma-separated keywords.',
      'No hashtags, no fake staff names, no invented offers.',
      `Creative angle for this pair: ${angle}.`,
      `Freshness token (vary wording): ${Date.now()}-${Math.floor(Math.random() * 10_000)}.`,
    ];
    if (strictRetry) {
      draftRules.push(
        'Previous output was too similar to earlier drafts — rewrite completely with new openings and vocabulary.',
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
          `Frame ${REVIEW_DRAFT_COUNT} short, authentic Google review drafts in the customer's voice (first person).`,
          'Base the text ONLY on the customer answers below — do not invent staff names, offers, or facts they did not mention.',
          ...draftRules,
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating they chose: ${stars} out of 5`,
          'Customer answers:',
          this.formatAnswers(answers),
          keywords.length
            ? `Merchant themes (use ONLY if the customer’s answers clearly relate): ${keywords.join(', ')}`
            : null,
        ]
      : [
          `Frame ${REVIEW_DRAFT_COUNT} short, authentic Google review drafts for a customer.`,
          ...draftRules,
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating: ${stars} out of 5`,
          keywords.length ? `Merchant themes (only if they fit): ${keywords.join(', ')}` : null,
        ];
    const promptText = prompt.filter(Boolean).join('\n');

    const text = await geminiGenerateText(apiKey, model, promptText, {
      temperature: strictRetry ? 1 : 0.95,
      maxOutputTokens: 1536,
      json: true,
    });

    const parsed = JSON.parse(extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
    const strings = parsed.filter(
      (row): row is string => typeof row === 'string' && row.trim().length > 3,
    );
    return selectDiverseDrafts(strings, REVIEW_DRAFT_COUNT);
  }
}
