export function reviewPublicUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/r/${encodeURIComponent(slug.trim())}`;
}

export function menuPublicUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/menu/${encodeURIComponent(slug.trim())}`;
}

export function commerceHubPublicPath(slug: string): string {
  return `/go/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export function commerceHubPublicUrl(appUrl: string, slug: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}${commerceHubPublicPath(slug)}`;
}

export function qrClaimUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/q/${encodeURIComponent(code)}`;
}

export function revisitPublicUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/$/, '');
  return `${base}/quick-revisit/${encodeURIComponent(code.trim())}`;
}
