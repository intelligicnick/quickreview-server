import { slugifyConnect } from '../connect/connect.util';
import { commerceHubPublicUrl, menuPublicUrl } from '../platform/qr-target.util';

export function slugifyMenuSlug(input: string): string {
  return slugifyConnect(input);
}

export function menuPublicPath(slug: string): string {
  return `/menu/${encodeURIComponent(slug.trim())}`;
}

export function menuPublicFullUrl(appUrl: string, slug: string): string {
  return menuPublicUrl(appUrl, slug);
}

export function commerceHubPublicPath(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `/go/${encodeURIComponent(normalized)}`;
}

export function commerceHubPublicFullUrl(appUrl: string, slug: string): string {
  return commerceHubPublicUrl(appUrl, slug);
}

export function formatInr(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  return `₹${Math.round(price)}`;
}
