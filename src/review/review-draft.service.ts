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
        if (fromGemini.length >= 1) return shuffle(fromGemini).slice(0, 4);
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
    const highlight = answers[0]?.answer ?? pickOne(keywords) ?? 'great service';
    const extra = answers[1]?.answer;
    const bit = highlight.trim();
    const more = extra?.trim();
    const at = category === BusinessCategory.SERVICES ? 'working with' : 'at';
    const openings = shuffle([
      more
        ? `${stars}-star experience ${at} ${name}. ${bit} — ${more}. Would recommend.`
        : `${stars}-star experience ${at} ${name}. ${bit} really stood out. Would use them again.`,
      `${name} delivered on ${bit.toLowerCase()}${more ? ` and ${more.toLowerCase()}` : ''}. Happy to recommend.`,
      more
        ? `If you need ${more.toLowerCase()}, ${name} is a solid choice. ${bit} — ${stars} stars from me.`
        : `Genuinely impressed with ${name} — especially ${bit.toLowerCase()}. ${stars}-star experience.`,
      pickOne([
        `I'd choose ${name} again. ${bit}${more ? `; ${more}` : ''}.`,
        `Clear ${stars}-star experience ${at} ${name}: ${bit}.`,
        `Recommend ${name} — ${bit.toLowerCase()}${more ? ` and ${more.toLowerCase()}` : ''} made the difference.`,
      ]) ?? `Solid ${stars}-star experience ${at} ${name}. ${bit}.`,
    ]);
    return openings;
  }

  private async geminiDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    apiKey: string,
  ): Promise<string[]> {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const prompt = answers.length
      ? [
          'Frame 4 short, authentic Google review drafts in the customer\'s voice (first person).',
          'Base the text ONLY on the customer answers below — do not invent staff names, offers, or facts they did not mention.',
          'Return ONLY a JSON array of 4 strings, no markdown.',
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating they chose: ${stars} out of 5`,
          'Customer answers:',
          this.formatAnswers(answers),
          keywords.length
            ? `Merchant themes (use ONLY if the customer’s answers clearly relate — never force unrelated words): ${keywords.join(', ')}`
            : null,
          'Rules: casual tone, 1-3 sentences each, no hashtags. Mirror the customer’s facts; do not invent offers, names, or dishes.',
          'Each draft must use a different opening and structure — no reused phrases between drafts.',
          'Vary length slightly (one shorter, one medium, one longer) across the four.',
        ]
      : [
          'Frame 4 short, authentic Google review drafts for a customer.',
          'Return ONLY a JSON array of 4 strings, no markdown.',
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          businessTypeHint(location.businessCategory),
          `Star rating: ${stars} out of 5`,
          keywords.length
            ? `Merchant themes (only if they fit): ${keywords.join(', ')}`
            : null,
          'Rules: casual tone, 1-3 sentences each, no hashtags, no fake staff names.',
        ];
    const promptText = prompt.filter(Boolean).join('\n');

    const text = await geminiGenerateText(apiKey, model, promptText, {
      temperature: 0.95,
      maxOutputTokens: 1536,
      json: true,
    });

    const parsed = JSON.parse(extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
    return parsed.filter((row): row is string => typeof row === 'string' && row.trim().length > 3);
  }
}
