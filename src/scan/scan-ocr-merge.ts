import type { Page } from 'tesseract.js';

const MIN_LINE_CONFIDENCE = 28;

/** Merge lines from many OCR passes; keep longest spelling when keys match. */
export function mergeOcrLines(candidates: string[]): string {
  const best = new Map<string, string>();
  for (const block of candidates) {
    for (const raw of block.split('\n')) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (line.length < 2) continue;
      const key = normalizeLineKey(line);
      if (!key) continue;
      const prev = best.get(key);
      if (!prev || line.length > prev.length || scoreLine(line) > scoreLine(prev)) {
        best.set(key, line);
      }
    }
  }
  return [...best.values()].join('\n');
}

export function linesFromPage(data: Page): string[] {
  const ranked: { y: number; text: string }[] = [];

  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = line.text?.replace(/\s+/g, ' ').trim();
        if (!text || text.length < 2) continue;
        if (line.confidence < MIN_LINE_CONFIDENCE) continue;
        ranked.push({ y: line.bbox.y0, text });
      }
      for (const word of collectWordsFromParagraph(paragraph)) {
        ranked.push(word);
      }
    }
  }

  if (ranked.length === 0) {
    return (data.text ?? '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 2);
  }

  ranked.sort((a, b) => a.y - b.y);
  return mergeOcrLines(ranked.map((row) => row.text))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);
}

/** Low-confidence single words (tiny print) missed at line level. */
function collectWordsFromParagraph(paragraph: {
  lines?: { words?: { text: string; confidence: number; bbox: { y0: number } }[] }[];
}): { y: number; text: string }[] {
  const out: { y: number; text: string }[] = [];
  for (const line of paragraph.lines ?? []) {
    for (const word of line.words ?? []) {
      const text = word.text?.trim();
      if (!text || text.length < 2) continue;
      if (word.confidence < MIN_LINE_CONFIDENCE + 5) continue;
      if (/^[\d\s.+()-]+$/.test(text)) continue;
      out.push({ y: word.bbox.y0, text });
    }
  }
  return out;
}

function normalizeLineKey(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9@.+]/g, '');
}

function scoreLine(line: string): number {
  const letters = line.replace(/[^a-zA-Z]/g, '').length;
  return letters + line.length * 0.1;
}

function selfCheck(): void {
  const merged = mergeOcrLines(['  Jane Doe\nAcme Inc ', 'Jane Doe', 'tiny.co']);
  if (!merged.includes('Jane Doe') || !merged.includes('Acme Inc') || !merged.includes('tiny.co')) {
    throw new Error('scan-ocr-merge self-check failed');
  }
}

selfCheck();
