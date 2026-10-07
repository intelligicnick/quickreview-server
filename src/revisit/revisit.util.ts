import { newReviewCode } from '../common/utils/review-code';

export function revisitPublicPath(code: string): string {
  return `/quick-revisit/${encodeURIComponent(code.trim())}`;
}

export function revisitPublicUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}${revisitPublicPath(code)}`;
}

export function newRewardCode(): string {
  return `QR-${newReviewCode(5)}`;
}

export function maskMobile(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

export function startOfCalendarDay(d: Date, tzOffsetMinutes = 330): Date {
  const local = new Date(d.getTime() + tzOffsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const day = local.getUTCDate();
  return new Date(Date.UTC(y, m, day) - tzOffsetMinutes * 60_000);
}
