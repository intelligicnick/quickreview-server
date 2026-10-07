export type NormalizeMobileResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; message: string };

/** Normalize Indian and generic mobile numbers to E.164 (+91…) for storage. */
export function normalizeMobile(raw: string, defaultCountry = '91'): NormalizeMobileResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: 'Enter your mobile number' };

  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  digits = digits.replace(/\D/g, '');

  if (digits.length < 10) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number' };
  }

  if (defaultCountry === '91') {
    if (digits.length === 10) digits = `91${digits}`;
    else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
    else if (digits.length === 12 && digits.startsWith('91')) {
      // ok
    } else if (digits.length > 12) {
      return { ok: false, message: 'Enter a valid mobile number' };
    }
    if (!digits.startsWith('91') || digits.length !== 12) {
      return { ok: false, message: 'Enter a valid 10-digit mobile number' };
    }
    const national = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(national)) {
      return { ok: false, message: 'Enter a valid Indian mobile number' };
    }
    return { ok: true, e164: `+${digits}`, national };
  }

  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, message: 'Enter a valid mobile number' };
  }
  return { ok: true, e164: `+${digits}`, national: digits };
}
