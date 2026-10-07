const MAX_IMPORT_BYTES = 12 * 1024 * 1024;

export function decodeImportedImageBase64(input: string): { bytes: Buffer; mimeType: string } {
  const trimmed = input.trim();
  const dataUrl = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  const base64 = dataUrl ? dataUrl[2] : trimmed;
  const mimeType = dataUrl?.[1] ?? 'image/png';
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) throw new Error('Empty image data');
  if (bytes.length > MAX_IMPORT_BYTES) throw new Error('Image is too large (max 12 MB)');
  return { bytes, mimeType };
}
