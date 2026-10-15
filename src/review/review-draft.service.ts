import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessCategory } from '../catalog/business-category.enum';
import { extractJsonArray, geminiGenerateText } from '../common/utils/gemini-client';
import { Location } from '../locations/location.entity';
import type { ReviewDraftAnswer } from './review-questions.constants';

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

/** Pick drafts that share the fewest content words (avoids near-duplicate options). */
function selectDiverseDrafts(candidates: string[], count: number): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of candidates) {
    const trimmed = row.trim();
    const key = trimmed.toLowerCase();
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

@Injectable()
export class ReviewDraftService {
  private readonly logger = new Logger(ReviewDraftService.name);

  constructor(private readonly config: ConfigService) {}

  async suggestDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
  ): Promise<string[]> {
    const normalizedKeywords = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12);
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey !== 'mock') {
      try {
        const fromGemini = await this.geminiDrafts(location, stars, normalizedKeywords, answers, apiKey);
        if (fromGemini.length >= 1) {
          return selectDiverseDrafts(fromGemini, REVIEW_DRAFT_COUNT);
        }
      } catch (err) {
        this.logger.warn(`Gemini drafts failed, using templates: ${String(err)}`);
      }
    }
    return this.templateDrafts(
      location.name,
      location.businessCategory,
      stars,
      normalizedKeywords,
      answers,
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
  ): string[] {
    const phrases = splitAnswerPhrases(answers);
    const fallback = pickOne(keywords) ?? 'great service';
    const a = phrases[0] ?? fallback;
    const b = phrases[1] ?? phrases[0] ?? fallback;
    const c = phrases[2];
    const at = category === BusinessCategory.SERVICES ? 'working with' : 'at';

    const draftA =
      c != null
        ? `I left ${name} with a ${stars}-star impression — ${a.toLowerCase()} and ${b.toLowerCase()} were exactly what I needed.`
        : `${stars} stars ${at} ${name}. ${a} stood out; I'd happily use them again.`;

    const draftB =
      c != null
        ? `Solid experience ${at} ${name}: ${c} mattered most to me, and the team delivered without hassle.`
        : `${name} earned my recommendation — ${b.toLowerCase()} made the visit worthwhile.`;

    return selectDiverseDrafts([draftA, draftB], REVIEW_DRAFT_COUNT);
  }

  private async geminiDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    apiKey: string,
  ): Promise<string[]> {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const draftRules = [
      `Return ONLY a JSON array of exactly ${REVIEW_DRAFT_COUNT} strings, no markdown.`,
      'Write 1–2 natural sentences per draft (real Google review tone).',
      'The two drafts must feel like different people wrote them — different opening, angle, and length.',
      'Do NOT repeat the same phrases, adjectives, or key nouns across both drafts (e.g. if draft A says "clear communication", draft B must use other words).',
      'Do NOT dump every customer bullet into each draft — split their points: highlight at most two ideas per draft, spread ideas across the pair.',
      'Prefer vivid, specific wording over stacking comma-separated keywords.',
      'No hashtags, no fake staff names, no invented offers.',
    ];

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
            ? `Merchant themes (use ONLY if the customer’s answers clearly relate — never force unrelated words): ${keywords.join(', ')}`
            : null,
        ]
      : [
          `Frame ${REVIEW_DRAFT_COUNT} short, authentic Google review drafts for a customer.`,
          ...draftRules,
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating: ${stars} out of 5`,
          keywords.length
            ? `Merchant themes (only if they fit): ${keywords.join(', ')}`
            : null,
        ];
    const promptText = prompt.filter(Boolean).join('\n');

    const text = await geminiGenerateText(apiKey, model, promptText, {
      temperature: 0.95,
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
