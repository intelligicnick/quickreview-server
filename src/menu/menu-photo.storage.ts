import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const MAX_EDGE = 960;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const MENU_PHOTO_SLOTS = 2;

export function menuPhotoRoot(): string {
  return process.env.MENU_UPLOAD_DIR ?? join(process.cwd(), 'data', 'menu-photos');
}

export function menuPhotoPath(itemId: string, slot: number): string {
  return join(menuPhotoRoot(), itemId, `${slot}.webp`);
}

export function isLocalPhotoRef(value: string): boolean {
  return value === 'local:0' || value === 'local:1';
}

export function localPhotoSlot(value: string): number {
  return value === 'local:1' ? 1 : 0;
}

export async function saveMenuPhoto(itemId: string, slot: number, buffer: Buffer, mimeType: string): Promise<void> {
  if (slot < 0 || slot >= MENU_PHOTO_SLOTS) {
    throw new Error('Invalid photo slot');
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error('Unsupported image type');
  }
  const dir = join(menuPhotoRoot(), itemId);
  await mkdir(dir, { recursive: true });
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(menuPhotoPath(itemId, slot), out);
}

export async function readMenuPhoto(itemId: string, slot: number): Promise<Buffer | null> {
  try {
    return await readFile(menuPhotoPath(itemId, slot));
  } catch {
    return null;
  }
}

export async function deleteMenuPhoto(itemId: string, slot: number): Promise<void> {
  try {
    await unlink(menuPhotoPath(itemId, slot));
  } catch {
    // missing file is fine
  }
}

export function normalizeStoredImageUrls(imageUrls: string[] | null | undefined, legacyUrl: string | null): string[] {
  const rows = [...(imageUrls ?? [])].filter((row) => typeof row === 'string' && row.trim()).slice(0, MENU_PHOTO_SLOTS);
  if (rows.length) return rows;
  if (legacyUrl?.trim()) return [legacyUrl.trim()];
  return [];
}

export function resolveMenuImageUrls(
  appUrl: string,
  itemId: string,
  imageUrls: string[] | null | undefined,
  legacyUrl: string | null,
): string[] {
  const stored = normalizeStoredImageUrls(imageUrls, legacyUrl);
  const base = appUrl.replace(/\/$/, '');
  const ordered: string[] = [];
  const push = (ref: string | undefined) => {
    if (!ref || ordered.length >= MENU_PHOTO_SLOTS) return;
    if (ordered.some((row) => row === ref)) return;
    ordered.push(ref);
  };
  push(stored.find((row) => row === 'local:0'));
  push(stored.find((row) => row === 'local:1'));
  for (const row of stored) {
    if (!isLocalPhotoRef(row)) push(row);
  }
  return ordered.map((row) => {
    if (isLocalPhotoRef(row)) {
      const slot = localPhotoSlot(row);
      return `${base}/api/public/menu/items/${itemId}/photos/${slot}`;
    }
    return row;
  });
}
