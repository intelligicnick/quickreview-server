import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Location } from '../locations/location.entity';

function pickOne<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

@Injectable()
export class ReviewDraftService {
  private readonly logger = new Logger(ReviewDraftService.name);

  constructor(private readonly config: ConfigService) {}

  async suggestDrafts(location: Location, stars: number, keywords: string[]): Promise<string[]> {
    const normalizedKeywords = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12);
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey && apiKey !== 'mock') {
      try {
        const fromGemini = await this.geminiDrafts(location, stars, normalizedKeywords, apiKey);
        if (fromGemini.length >= 2) return fromGemini.slice(0, 4);
      } catch (err) {
        this.logger.warn(`Gemini drafts failed, using templates: ${String(err)}`);
      }
    }
    return this.templateDrafts(location.name, stars, normalizedKeywords);
  }

  private templateDrafts(name: string, stars: number, keywords: string[]): string[] {
    const topic = pickOne(keywords);
    const topicBit = topic ? ` — especially ${topic}` : '';
    return [
      `Had a ${stars}-star visit at ${name}${topicBit}. Friendly team and would come back.`,
      `${name} delivered exactly what I needed${topic ? ` (${topic})` : ''}. Happy to recommend.`,
      `Solid ${stars}-star experience at ${name}. Quick, professional, and worth it.`,
      `Really pleased with ${name}${topicBit}. Left a ${stars}-star review on Google.`,
    ];
  }

  private async geminiDrafts(
    location: Location,
    stars: number,
    keywords: string[],
    apiKey: string,
  ): Promise<string[]> {
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    const prompt = [
      'Write 4 short, authentic Google review drafts for a customer.',
      'Return ONLY a JSON array of 4 strings, no markdown.',
      `Business: ${location.name}`,
      location.address ? `Address hint: ${location.address}` : null,
      `Star rating: ${stars} out of 5`,
      keywords.length ? `Naturally mention one of these when relevant: ${keywords.join(', ')}` : null,
      'Rules: casual tone, 1-3 sentences each, no hashtags, no fake staff names.',
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
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
