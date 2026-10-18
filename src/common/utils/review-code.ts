import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const QR_STOCK_CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Normalize a scanned or pasted standee `/q/` payload to an 8-char stock code. */
export function normalizeQrStockCode(raw: string): string {
  const trimmed = raw.trim();
  const fromPath = trimmed.match(/\/q\/([A-Za-z0-9]+)/i)?.[1];
  if (fromPath) return fromPath.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  try {
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const parts = url.pathname.split('/').filter(Boolean);
    const qIdx = parts.findIndex((p) => p.toLowerCase() === 'q');
    if (qIdx >= 0 && parts[qIdx + 1]) {
      return parts[qIdx + 1].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }
  } catch {
    /* not a URL */
  }

  const compact = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (compact.length <= 8) return compact;
  const tail = compact.slice(-8);
  if (QR_STOCK_CODE_RE.test(tail)) return tail;
  return compact.slice(0, 8);
}

export function newReviewCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function parseGooglePlaceId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^ChI[\w-]{10,}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('placeid') ?? url.searchParams.get('place_id');
    if (fromQuery) return fromQuery;
  } catch {
    // Not a URL — try regex below.
  }
  const match = /placeid=([^&]+)/i.exec(trimmed);
  return match ? decodeURIComponent(match[1]) : null;
}

export function googleWriteReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}
