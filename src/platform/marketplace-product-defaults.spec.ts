import {
  defaultAssetsForProductName,
  upgradeMarketplaceImageUrl,
} from './marketplace-product-defaults';

describe('marketplace-product-defaults', () => {
  it('matches renamed standee products', () => {
    expect(defaultAssetsForProductName('standee — Menu QR')?.imageUrl).toBe(
      '/marketplace/standee-menu-4x6.svg',
    );
    expect(defaultAssetsForProductName('Classic Review Standy')?.imageUrl).toBe(
      '/marketplace/standee-review-4x6.svg',
    );
  });

  it('matches QuickCommerce table tent', () => {
    expect(defaultAssetsForProductName('Menu table tent — QuickCommerce')?.imageUrl).toBe(
      '/marketplace/tent-menu-5x7.svg',
    );
  });

  it('upgrades legacy svg paths to png', () => {
    expect(upgradeMarketplaceImageUrl('/marketplace/standee-menu-qr.svg')).toBe(
      '/marketplace/standee-menu-4x6.svg',
    );
  });
});
