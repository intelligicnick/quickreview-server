import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Location } from '../locations/location.entity';
import type { ReviewDraftAnswer } from './review-questions.constants';

function pickOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]!;
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
        if (fromGemini.length >= 1) return fromGemini.slice(0, 3);
      } catch (err) {
        this.logger.warn(`Gemini drafts failed, using templates: ${String(err)}`);
      }
    }
    return this.templateDrafts(location.name, stars, normalizedKeywords, answers);
  }

  private formatAnswers(answers: ReviewDraftAnswer[]): string {
    return answers.map((row) => `Q: ${row.question}\nA: ${row.answer}`).join('\n\n');
  }

  private templateDrafts(
    name: string,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
  ): string[] {
    const highlight = answers[0]?.answer ?? pickOne(keywords) ?? 'great service';
    const extra = answers[1]?.answer;
    const bit = highlight.trim();
    const more = extra?.trim();
    const base = more
      ? `Had a ${stars}-star visit at ${name}. Loved the ${bit.toLowerCase()} — ${more}. Would recommend.`
      : `Had a ${stars}-star visit at ${name}. The ${bit.toLowerCase()} really stood out. Would come back.`;
    const alt = `Worth the visit — ${name} delivered on ${bit.toLowerCase()}${more ? ` and ${more.toLowerCase()}` : ''}. I'd go again.`;
    const alt2 = more
      ? `If you want ${more.toLowerCase()} and a welcoming vibe, try ${name}. Left with a ${stars}-star feeling.`
      : `Friends keep asking where I went — ${name} nailed the ${bit.toLowerCase()}. Genuine ${stars}-star experience.`;
    return [base, alt, alt2];
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
          'Write 3 short, authentic Google review drafts in the customer\'s voice (first person).',
          'Base the text ONLY on the customer answers below — do not invent staff names, offers, or facts they did not mention.',
          'Return ONLY a JSON array of 3 strings, no markdown.',
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          `Star rating they chose: ${stars} out of 5`,
          'Customer answers:',
          this.formatAnswers(answers),
          keywords.length ? `If natural, weave in one of these business themes: ${keywords.join(', ')}` : null,
          'Rules: casual tone, 1-3 sentences each, no hashtags.',
          'Drafts 2 and 3 must be completely rephrased — different openings and sentence structure, no reused phrases from draft 1.',
        ]
      : [
          'Write 4 short, authentic Google review drafts for a customer.',
          'Return ONLY a JSON array of 4 strings, no markdown.',
          `Business: ${location.name}`,
          location.address ? `Address hint: ${location.address}` : null,
          `Star rating: ${stars} out of 5`,
          keywords.length ? `Naturally mention one of these when relevant: ${keywords.join(', ')}` : null,
          'Rules: casual tone, 1-3 sentences each, no hashtags, no fake staff names.',
        ];
    const promptText = prompt.filter(Boolean).join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty Gemini response');

    const parsed = JSON.parse(this.extractJsonArray(text)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
    return parsed.filter((row): row is string => typeof row === 'string' && row.trim().length > 3);
  }

  private extractJsonArray(raw: string): string {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) return raw.slice(start, end + 1);
    return raw;
  }
}
