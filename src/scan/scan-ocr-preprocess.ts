import sharp from 'sharp';

const MAX_EDGE = 4500;
const TILE_COLS = 3;
const TILE_ROWS = 3;

export async function buildOcrVariants(buffer: Buffer): Promise<Buffer[]> {
  const rotated = sharp(buffer).rotate();
  const resized = rotated.resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: false,
  });

  const photo = await resized
    .clone()
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.1 })
    .png()
    .toBuffer();

  const crisp = await resized
    .clone()
    .grayscale()
    .median(3)
    .normalize()
    .linear(1.45, -48)
    .sharpen({ sigma: 1.6 })
    .png()
    .toBuffer();

  const inverted = await resized
    .clone()
    .grayscale()
    .negate()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

  return [photo, crisp, inverted];
}

/** ponytail: 3×3 tiles on the main variant; upgrade path = adaptive grid from layout detection. */
export async function sliceOcrTiles(buffer: Buffer): Promise<Buffer[]> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 400 || height < 400) return [];

  const tileW = Math.ceil(width / TILE_COLS);
  const tileH = Math.ceil(height / TILE_ROWS);
  const overlap = Math.round(Math.min(tileW, tileH) * 0.08);
  const tiles: Buffer[] = [];

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const left = Math.max(0, col * tileW - overlap);
      const top = Math.max(0, row * tileH - overlap);
      const right = Math.min(width, (col + 1) * tileW + overlap);
      const bottom = Math.min(height, (row + 1) * tileH + overlap);
      const extractW = right - left;
      const extractH = bottom - top;
      if (extractW < 80 || extractH < 80) continue;

      tiles.push(
        await sharp(buffer)
          .extract({ left, top, width: extractW, height: extractH })
          .resize({
            width: Math.min(MAX_EDGE, extractW * 2),
            height: Math.min(MAX_EDGE, extractH * 2),
            fit: 'inside',
            withoutEnlargement: false,
          })
          .png()
          .toBuffer(),
      );
    }
  }

  return tiles;
}
