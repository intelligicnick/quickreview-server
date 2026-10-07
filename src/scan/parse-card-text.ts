import { normalizeParsedCard, type ParsedCard } from './scan.util';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-z]{2,}(?:\/[^\s,;)]*)?/gi;
const PHONE_CANDIDATE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4,8}/g;

const ADDRESS_HINTS =
  /\b(road|rd\.?|street|st\.?|lane|avenue|ave\.?|nagar|colony|floor|fl\.?|building|bldg|pin|pincode|india|city|state|dist|district)\b|\b\d{6}\b/i;
const SERVICE_HINTS =
  /\b(services?|consulting|installation|repair|maintenance|support|solutions|agency|training|coaching)\b/i;
const PRODUCT_HINTS =
  /\b(products?|dealer|supplier|manufactur|wholesale|retail|trading|importer|exporter)\b/i;
const COMPANY_HINTS =
  /\b(pvt\.?\s*ltd|private\s+limited|limited|ltd\.?|llp|inc\.?|corp\.?|enterprises|technologies|industries|company|co\.)\b/i;
const DESIGNATION_HINTS =
  /\b(director|manager|ceo|cfo|cto|founder|proprietor|partner|consultant|engineer|executive|president|vice\s+president|vp|head\s+of)\b/i;

export function parseVisitingCardText(rawText: string): ParsedCard {
  const normalized = fixCommonOcrArtifacts(rawText);
  const lines = uniqueLines(
    normalized
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => collapseSpaces(line))
      .filter((line) => line.length > 0 && !isOcrNoise(line)),
  );

  const text = lines.join(' ');

  const emails = uniqueEmails([...text.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase()));
  const websites = uniqueStrings(
    [...text.matchAll(URL_RE)]
      .map((m) => normalizeWebsite(m[0]))
      .filter((url) => !emails.some((email) => url.toLowerCase().includes(email))),
  );
  const phones = dedupePhones(extractPhones(text));

  const consumed = new Set<number>();
  markConsumedByContactTokens(lines, consumed, emails, websites, phones);

  let fullName: string | null = null;
  const namePick = pickPersonName(lines, consumed);
  if (namePick) {
    fullName = namePick.line;
    consumed.add(namePick.index);
  }

  const companyParts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    if (!COMPANY_HINTS.test(lines[i])) continue;
    companyParts.push(lines[i]);
    consumed.add(i);
    break;
  }

  const addressParts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    if (!ADDRESS_HINTS.test(lines[i])) continue;
    addressParts.push(lines[i]);
    consumed.add(i);
    if (i + 1 < lines.length && !consumed.has(i + 1) && ADDRESS_HINTS.test(lines[i + 1])) {
      addressParts.push(lines[i + 1]);
      consumed.add(i + 1);
    }
  }

  const services: string[] = [];
  const products: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    if (SERVICE_HINTS.test(line)) {
      services.push(line);
      consumed.add(i);
      continue;
    }
    if (PRODUCT_HINTS.test(line)) {
      products.push(line);
      consumed.add(i);
    }
  }

  const otherParts: string[] = [...companyParts];
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    if (DESIGNATION_HINTS.test(line) && otherParts.length < 4) {
      otherParts.push(line);
      consumed.add(i);
      continue;
    }
    if (isDuplicateOfKnown(line, fullName, addressParts, services, products, phones, emails, websites)) {
      continue;
    }
    if (otherParts.length >= 4) continue;
    if (!isLikelyOtherLine(line)) continue;
    otherParts.push(line);
    consumed.add(i);
  }

  return normalizeParsedCard({
    fullName,
    phones,
    emails,
    websites,
    address: joinField(addressParts),
    services: uniqueStrings(services),
    products: uniqueStrings(products),
    other: joinField(otherParts),
  });
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function joinField(parts: string[], maxLen = 480): string | null {
  const cleaned = uniqueStrings(parts.map(collapseSpaces).filter(Boolean));
  if (!cleaned.length) return null;
  let joined = cleaned.join(', ');
  if (joined.length > maxLen) joined = `${joined.slice(0, maxLen - 1).trim()}…`;
  return joined;
}

function isLikelyOtherLine(line: string): boolean {
  if (line.length < 4 || line.length > 120) return false;
  if (COMPANY_HINTS.test(line)) return true;
  const letters = line.replace(/[^a-zA-Z]/g, '').length;
  if (letters < 4 || letters / line.length < 0.45) return false;
  if (SERVICE_HINTS.test(line) || PRODUCT_HINTS.test(line) || ADDRESS_HINTS.test(line)) return false;
  return line.split(' ').length <= 12;
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^a-z0-9@.+]/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function isOcrNoise(line: string): boolean {
  if (line.length <= 2) return true;
  const letters = line.replace(/[^a-zA-Z]/g, '').length;
  const digits = line.replace(/\D/g, '').length;
  if (digits >= 10) return false;
  if (lineHasEmail(line) || lineHasUrl(line)) return false;
  if (letters === 0) return true;
  if (letters / line.length < 0.25 && digits < 6) return true;
  if (/^[\s|_\-–—•·.…*+=/\\[\]{}()]+$/.test(line)) return true;
  if (/^[Il1O0|]{2,}$/i.test(line.replace(/\s/g, ''))) return true;
  if (/\b(logo|tagline|since\s+\d{4})\b/i.test(line) && line.length < 40) return true;
  return false;
}

function markConsumedByContactTokens(
  lines: string[],
  consumed: Set<number>,
  emails: string[],
  websites: string[],
  phones: string[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineHasEmail(line) || lineHasUrl(line) || looksLikePhoneLine(line)) {
      consumed.add(i);
      continue;
    }
    const lower = line.toLowerCase();
    if (emails.some((e) => lower.includes(e))) consumed.add(i);
    if (websites.some((w) => lower.includes(w.replace(/^https?:\/\//i, '')))) consumed.add(i);
    if (phones.some((p) => line.includes(p.replace(/\s/g, '')) || line.includes(p))) consumed.add(i);
  }
}

function isDuplicateOfKnown(
  line: string,
  name: string | null,
  addresses: string[],
  services: string[],
  products: string[],
  phones: string[],
  emails: string[],
  websites: string[],
): boolean {
  const key = line.toLowerCase();
  if (name && key === name.toLowerCase()) return true;
  if (addresses.some((a) => a.toLowerCase() === key)) return true;
  if (services.some((s) => s.toLowerCase() === key)) return true;
  if (products.some((p) => p.toLowerCase() === key)) return true;
  if (emails.some((e) => key.includes(e))) return true;
  if (websites.some((w) => key.includes(w.toLowerCase()))) return true;
  const digits = line.replace(/\D/g, '');
  if (digits.length >= 10 && phones.some((p) => p.replace(/\D/g, '') === digits)) return true;
  return false;
}

function lineHasEmail(line: string): boolean {
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line);
}

function lineHasUrl(line: string): boolean {
  return /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-z]{2,}/i.test(line);
}

function extractPhones(text: string): string[] {
  const found: string[] = [];
  const labeled = text.replace(
    /(?:^|\s)(?:m(?:ob(?:ile)?)?|mobile|cell|tel(?:ephone)?|phone|ph|whatsapp|wa)[\s.:]*(?=(?:\+?\d[\d\s().-]{8,}))/gi,
    ' ',
  );
  for (const match of labeled.matchAll(PHONE_CANDIDATE_RE)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) continue;
    const formatted = formatPhone(match[0].trim(), digits);
    if (formatted) found.push(formatted);
  }
  return found;
}

function dedupePhones(phones: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phone of phones) {
    const key = phone.replace(/\D/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(collapseSpaces(phone));
  }
  return out;
}

function formatPhone(raw: string, digits: string): string | null {
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  if (raw.startsWith('+') || digits.length >= 11) {
    return collapseSpaces(raw);
  }
  return null;
}

function looksLikePhoneLine(line: string): boolean {
  const digits = line.replace(/\D/g, '');
  return digits.length >= 10 && digits.length / line.length > 0.45;
}

function fixCommonOcrArtifacts(text: string): string {
  return text
    .replace(/(\w)\s+@\s+(\w)/g, '$1@$2')
    .replace(/(\w)\s*\(\s*at\s*\)\s*(\w)/gi, '$1@$2')
    .replace(/\b([a-z0-9._%+-]+)\s+@\s+([a-z0-9.-]+\.[a-z]{2,})\b/gi, '$1@$2');
}

function pickPersonName(
  lines: string[],
  consumed: Set<number>,
): { line: string; index: number } | null {
  let best: { line: string; index: number; score: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const score = scorePersonNameLine(lines[i]);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { line: lines[i], index: i, score };
  }
  return best ? { line: best.line, index: best.index } : null;
}

function scorePersonNameLine(line: string): number {
  if (!isLikelyNameLine(line)) return 0;
  if (COMPANY_HINTS.test(line)) return 0;
  if (DESIGNATION_HINTS.test(line)) return 0;

  let score = 4;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 4) score += 10;
  if (words.length === 1) score += 2;
  if (isTitleCaseLine(line)) score += 8;
  if (line.length > 12 && line === line.toUpperCase()) score -= 6;
  if (SERVICE_HINTS.test(line) || PRODUCT_HINTS.test(line)) score -= 4;
  return score;
}

function isTitleCaseLine(line: string): boolean {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  let titled = 0;
  for (const word of words) {
    if (/^[A-Z][a-z'.-]+$/.test(word)) titled += 1;
  }
  return titled >= Math.min(2, words.length);
}

function isLikelyNameLine(line: string): boolean {
  if (line.length < 3 || line.length > 60) return false;
  if (lineHasEmail(line) || lineHasUrl(line) || looksLikePhoneLine(line)) return false;
  if (SERVICE_HINTS.test(line) || PRODUCT_HINTS.test(line) || ADDRESS_HINTS.test(line)) return false;
  if (COMPANY_HINTS.test(line)) return false;
  const letters = line.replace(/[^a-zA-Z]/g, '').length;
  return letters >= 3 && letters / line.length > 0.5;
}

function normalizeWebsite(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^www\./i, 'www.')}`;
}

function uniqueEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = collapseSpaces(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function selfCheck(): void {
  const sample = `
ACME TECHNOLOGIES PVT LTD
Rajesh Kumar
Director
Mob: +91 98765 43210
rajesh @ acme.co.in
www.acme.co.in
123 MG Road, Bangalore 560001
`.trim();
  const parsed = parseVisitingCardText(sample);
  if (parsed.fullName !== 'Rajesh Kumar') {
    throw new Error(`parse-card-text self-check name: ${parsed.fullName}`);
  }
  if (!parsed.emails.some((e) => e.includes('rajesh@acme.co.in'))) {
    throw new Error('parse-card-text self-check email');
  }
  if (!parsed.phones.some((p) => p.replace(/\D/g, '').includes('9876543210'))) {
    throw new Error('parse-card-text self-check phone');
  }
}

selfCheck();
