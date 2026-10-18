import { assertSafeExternalUrl, isSafeExternalUrl } from './safe-external-url';

describe('safe-external-url', () => {
  it('allows common navigational schemes', () => {
    expect(isSafeExternalUrl('https://example.com/path')).toBe(true);
    expect(isSafeExternalUrl('mailto:a@b.co')).toBe(true);
    expect(assertSafeExternalUrl('tel:+15551212')).toBe('tel:+15551212');
  });

  it('rejects dangerous schemes', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,hi')).toBe(false);
  });
});
