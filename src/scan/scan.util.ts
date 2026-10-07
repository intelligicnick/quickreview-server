import type { ScannedContact } from './scanned-contact.entity';

export function buildVcard(contact: ScannedContact): string {
  const name = contact.fullName?.trim() || 'Contact';
  const note = buildVcardNote(contact);
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVcard(name)}`,
    ...(contact.phones ?? []).map((phone) => `TEL;TYPE=CELL:${escapeVcard(phone)}`),
    ...(contact.emails ?? []).map((email) => `EMAIL:${escapeVcard(email)}`),
    ...(contact.websites ?? []).map((url) => `URL:${escapeVcard(url)}`),
    contact.address ? `ADR;TYPE=WORK:;;${escapeVcard(contact.address)};;;;` : '',
    note ? `NOTE:${escapeVcard(note)}` : '',
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n');
}

function buildVcardNote(contact: ScannedContact): string | null {
  const parts: string[] = [];
  if (contact.services?.length) parts.push(`Services: ${contact.services.join(', ')}`);
  if (contact.products?.length) parts.push(`Products: ${contact.products.join(', ')}`);
  if (contact.notes?.trim()) parts.push(contact.notes.trim());
  return parts.length ? parts.join(' | ') : null;
}

function escapeVcard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/\n/g, ' ');
}

export type ParsedCard = {
  fullName: string | null;
  phones: string[];
  emails: string[];
  websites: string[];
  address: string | null;
  services: string[];
  products: string[];
  other: string | null;
};

const LIMITS = {
  fullName: 160,
  address: 500,
  other: 480,
  listItem: 160,
  phones: 8,
  emails: 6,
  websites: 6,
  services: 8,
  products: 8,
};

export function normalizeParsedCard(raw: Partial<ParsedCard>): ParsedCard {
  return clampParsedCard({
    fullName: cleanOptional(raw.fullName),
    phones: uniqueStrings(raw.phones),
    emails: uniqueStrings(raw.emails?.map((e) => e.toLowerCase())),
    websites: uniqueStrings(raw.websites),
    address: cleanOptional(raw.address),
    services: uniqueStrings(raw.services),
    products: uniqueStrings(raw.products),
    other: cleanOptional(raw.other),
  });
}

/** Guards DB varchar limits after OCR (ponytail: parser should drop junk; this is the seatbelt). */
export function clampParsedCard(card: ParsedCard): ParsedCard {
  return {
    fullName: capOptional(card.fullName, LIMITS.fullName),
    phones: card.phones.slice(0, LIMITS.phones).map((p) => cap(p, 40)),
    emails: card.emails.slice(0, LIMITS.emails).map((e) => cap(e, 254)),
    websites: card.websites.slice(0, LIMITS.websites).map((w) => cap(w, 500)),
    address: capOptional(card.address, LIMITS.address),
    services: card.services.slice(0, LIMITS.services).map((s) => cap(s, LIMITS.listItem)),
    products: card.products.slice(0, LIMITS.products).map((p) => cap(p, LIMITS.listItem)),
    other: capOptional(card.other, LIMITS.other),
  };
}

function cleanOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cap(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function capOptional(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return cap(trimmed, max);
}

export function clampOtherField(value: string | null | undefined): string | null {
  return capOptional(cleanOptional(value), LIMITS.other);
}

export function cardHasSignal(card: ParsedCard): boolean {
  return Boolean(
    card.fullName?.trim() ||
      card.phones.length ||
      card.emails.length ||
      card.websites.length ||
      card.address?.trim(),
  );
}

export function cardLooksComplete(card: ParsedCard): boolean {
  if (!card.fullName?.trim()) return false;
  return card.phones.length > 0 || card.emails.length > 0;
}

/** Prefer Gemini strings; fill list gaps from OCR parse. */
export function mergeParsedCards(primary: ParsedCard, fallback: ParsedCard): ParsedCard {
  return normalizeParsedCard({
    fullName: primary.fullName ?? fallback.fullName,
    phones: primary.phones.length ? primary.phones : fallback.phones,
    emails: primary.emails.length ? primary.emails : fallback.emails,
    websites: primary.websites.length ? primary.websites : fallback.websites,
    address: primary.address ?? fallback.address,
    services: primary.services.length ? primary.services : fallback.services,
    products: primary.products.length ? primary.products : fallback.products,
    other: primary.other ?? fallback.other,
  });
}

function uniqueStrings(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
