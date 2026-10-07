import { Logger } from '@nestjs/common';

const logger = new Logger('GeminiClient');

export async function geminiGenerateText(
  apiKey: string,
  model: string,
  prompt: string,
  options?: { temperature?: number; maxOutputTokens?: number },
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.85,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Gemini text response');
  return text;
}

export async function geminiGenerateImage(
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio = '9:16',
): Promise<{ bytes: Buffer; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio },
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini image HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) {
      return {
        bytes: Buffer.from(data, 'base64'),
        mimeType: part.inlineData?.mimeType || 'image/png',
      };
    }
  }
  throw new Error('Gemini did not return an image');
}

export async function geminiExtractJsonFromImages(
  apiKey: string,
  model: string,
  instruction: string,
  images: Array<{ mimeType: string; base64: string }>,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: instruction },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
  ];
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini vision HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Gemini vision response');
  return text;
}

export function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

export function mockPosterPng(label: string, aspectRatio = '9:16'): Buffer {
  const [w, h] = mockPosterSize(aspectRatio);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6B2FD5"/><stop offset="100%" stop-color="#1a1033"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="40" y="120" fill="white" font-family="system-ui,sans-serif" font-size="28" font-weight="700">QuickDesign</text>
  <text x="40" y="200" fill="#e8dcff" font-family="system-ui,sans-serif" font-size="22">${escapeXml(label.slice(0, 80))}</text>
  <text x="40" y="${h - 40}" fill="#ffffff99" font-family="system-ui,sans-serif" font-size="14">${escapeXml(aspectRatio)} · mock</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

function mockPosterSize(aspectRatio: string): [number, number] {
  const base = 540;
  const [a, b] = aspectRatio.split(':').map((n) => Number(n));
  if (!a || !b) return [base, 960];
  if (a >= b) return [base, Math.round((base * b) / a)];
  return [Math.round((base * a) / b), base];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function logGeminiFallback(err: unknown, context: string): void {
  logger.warn(`${context}: ${err instanceof Error ? err.message : String(err)}`);
}
