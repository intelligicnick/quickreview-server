import { normalizeMarketplaceImagePath, resolveMarketplaceImageUrl } from './marketplace-image-url';

describe('marketplace-image-url', () => {
  it('normalizes relative paths to site root', () => {
    expect(normalizeMarketplaceImagePath('marketplace/foo.svg')).toBe('/marketplace/foo.svg');
    expect(normalizeMarketplaceImagePath('/marketplace/foo.svg')).toBe('/marketplace/foo.svg');
  });

  it('keeps catalog paths relative for the SPA', () => {
    expect(resolveMarketplaceImageUrl('/marketplace/foo.svg', 'https://www.example.com')).toBe(
      '/marketplace/foo.svg',
    );
    expect(
      resolveMarketplaceImageUrl('https://www.example.com/marketplace/foo.svg', null),
    ).toBe('/marketplace/foo.svg');
    expect(resolveMarketplaceImageUrl('https://cdn.example.com/photo.jpg', null)).toBe(
      'https://cdn.example.com/photo.jpg',
    );
  });
});
