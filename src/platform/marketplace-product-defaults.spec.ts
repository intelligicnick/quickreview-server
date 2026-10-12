import {
  defaultAssetsForProductName,
  upgradeMarketplaceImageUrl,
} from './marketplace-product-defaults';

describe('marketplace-product-defaults', () => {
  it('matches renamed standee products', () => {
    expect(defaultAssetsForProductName('standee — Menu QR')?.imageUrl).toBe(
      '/marketplace/standee-menu-qr.png',
    );
    expect(defaultAssetsForProductName('Classic Review Standy')?.imageUrl).toBe(
      '/marketplace/standee-review-qr.png',
    );
  });

  it('upgrades legacy svg paths to png', () => {
    expect(upgradeMarketplaceImageUrl('/marketplace/standee-menu-qr.svg')).toBe(
      '/marketplace/standee-menu-qr.png',
    );
  });
});
