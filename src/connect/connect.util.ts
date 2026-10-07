export function slugifyConnect(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function connectPublicUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/c/${encodeURIComponent(slug.trim())}`;
}

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? `tel:${digits}` : `tel:${digits}`;
}

export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}
