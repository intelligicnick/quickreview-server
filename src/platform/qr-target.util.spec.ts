import { commerceHubPublicPath, commerceHubPublicUrl } from './qr-target.util';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(commerceHubPublicPath('Cafe-Main') === '/go/cafe-main', 'hub path lowercases slug');
assert(
  commerceHubPublicUrl('https://app.example.com', 'cafe-main') === 'https://app.example.com/go/cafe-main',
  'hub url',
);
