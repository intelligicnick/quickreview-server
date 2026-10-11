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
    const base = extra
      ? `Had a ${stars}-star visit at ${name}. ${highlight}. ${extra}. Would recommend.`
      : `Had a ${stars}-star visit at ${name} — especially ${highlight}. Friendly team and would come back.`;
    const alt = `${name} delivered exactly what I needed. ${highlight}. Happy to recommend.`;
    return [base, alt, `Really pleased with ${name}. ${highlight}. Left a ${stars}-star review on Google.`];
  }

  private async geminiDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    answers: ReviewDraftAnswer[],
    apiKey: string,
  ): Promise<string[]> {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const prompt = [
      'Write 3 short, authentic Google review drafts in the customer\'s voice (first person).',
      'Base the text ONLY on the customer answers below — do not invent staff names, offers, or facts they did not mention.',
      'Return ONLY a JSON array of 3 strings, no markdown.',
      `Business: ${location.name}`,
      location.address ? `Address hint: ${location.address}` : null,
      `Star rating they chose: ${stars} out of 5`,
      'Customer answers:',
      this.formatAnswers(answers),
      keywords.length ? `If natural, weave in one of these business themes: ${keywords.join(', ')}` : null,
      'Rules: casual tone, 1-3 sentences each, no hashtags, varied wording across the 3 drafts.',
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
