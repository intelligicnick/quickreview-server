const ALLOWED = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Reject javascript:, data:, and other non-navigational schemes for user-supplied hrefs. */
export function assertSafeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!ALLOWED.has(parsed.protocol)) {
    throw new Error('URL scheme is not allowed');
  }
  return trimmed;
}

export function isSafeExternalUrl(raw: string): boolean {
  try {
    assertSafeExternalUrl(raw);
    return true;
  } catch {
    return false;
  }
}
