import { normalizeMarketplaceImagePath, resolveMarketplaceImageUrl } from './marketplace-image-url';

describe('marketplace-image-url', () => {
  it('normalizes relative paths to site root', () => {
    expect(normalizeMarketplaceImagePath('marketplace/foo.svg')).toBe('/marketplace/foo.svg');
    expect(normalizeMarketplaceImagePath('/marketplace/foo.svg')).toBe('/marketplace/foo.svg');
  });

  it('resolves against APP_URL', () => {
    expect(resolveMarketplaceImageUrl('/marketplace/foo.svg', 'https://www.example.com')).toBe(
      'https://www.example.com/marketplace/foo.svg',
    );
  });
});
