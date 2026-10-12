export type MarketplaceProductAssets = { imageUrl: string; dimensions: string };

const STANDEE_REVIEW: MarketplaceProductAssets = {
  imageUrl: '/marketplace/standee-review-qr.png',
  dimensions: '4×6 in (4″ W × 6″ H)',
};

const STANDEE_MENU: MarketplaceProductAssets = {
  imageUrl: '/marketplace/standee-menu-qr.png',
  dimensions: '4×6 in (4″ W × 6″ H)',
};

const NFC_CARD: MarketplaceProductAssets = {
  imageUrl: '/marketplace/nfc-review-card.svg',
  dimensions: '85.6 × 54 mm (3.37″ × 2.13″)',
};

const LEGACY_IMAGE_UPGRADES: Record<string, string> = {
  '/marketplace/standee-review-qr.svg': STANDEE_REVIEW.imageUrl,
  '/marketplace/standee-menu-qr.svg': STANDEE_MENU.imageUrl,
};

export function defaultAssetsForProductName(name: string): MarketplaceProductAssets | null {
  const lower = name.toLowerCase();
  if (lower.includes('menu') && lower.includes('qr')) return STANDEE_MENU;
  if (lower.includes('nfc') || (lower.includes('card') && lower.includes('review'))) return NFC_CARD;
  if (lower.includes('standee') || (lower.includes('review') && lower.includes('qr'))) return STANDEE_REVIEW;
  return null;
}

export function upgradeMarketplaceImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl?.trim()) return imageUrl ?? null;
  const path = imageUrl.trim().startsWith('/') ? imageUrl.trim() : `/${imageUrl.trim()}`;
  return LEGACY_IMAGE_UPGRADES[path] ?? imageUrl.trim();
}

export const DEFAULT_QR_PRODUCT_SEEDS: Array<
  MarketplaceProductAssets & { name: string; description: string; priceInr: number; sortOrder: number; categoryName: string }
> = [
  {
    name: 'Acrylic standee — Review QR',
    description: 'Pre-printed standee wired to your review page.',
    ...STANDEE_REVIEW,
    priceInr: 349,
    sortOrder: 1,
    categoryName: 'Standees',
  },
  {
    name: 'Acrylic standee — Menu QR',
    description: 'Menu or catalogue QR for tables and counters.',
    ...STANDEE_MENU,
    priceInr: 349,
    sortOrder: 2,
    categoryName: 'Standees',
  },
  {
    name: 'NFC review card',
    description: 'Tap-to-review card paired with your location.',
    ...NFC_CARD,
    priceInr: 499,
    sortOrder: 3,
    categoryName: 'Cards & NFC',
  },
];
