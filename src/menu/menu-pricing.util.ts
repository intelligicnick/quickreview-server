export type SerializedVariant = { id: string; name: string; sortOrder: number };

export type SerializedVariantPrice = { variantId: string; priceInr: number };

export function minVariantPrice(prices: SerializedVariantPrice[]): number | null {
  if (!prices.length) return null;
  const values = prices.map((row) => row.priceInr).filter((n) => Number.isFinite(n));
  return values.length ? Math.min(...values) : null;
}

export function maxVariantPrice(prices: SerializedVariantPrice[]): number | null {
  if (!prices.length) return null;
  const values = prices.map((row) => row.priceInr).filter((n) => Number.isFinite(n));
  return values.length ? Math.max(...values) : null;
}

export function itemPricingFields(
  priceInr: number | null,
  categoryVariants: SerializedVariant[],
  variantPrices: SerializedVariantPrice[],
) {
  const multi = categoryVariants.length > 1;
  const fromPrice = multi ? (minVariantPrice(variantPrices) ?? priceInr) : (priceInr ?? minVariantPrice(variantPrices));
  const maxPrice = multi ? maxVariantPrice(variantPrices) : null;
  return {
    isMultiPriced: multi,
    displayPriceInr: fromPrice,
    maxPriceInr: multi && maxPrice != null && fromPrice != null && maxPrice > fromPrice ? maxPrice : null,
    variantPrices,
  };
}

if (process.env.NODE_ENV === 'test' || process.env.MENU_PRICING_SELF_CHECK === '1') {
  const fields = itemPricingFields(100, [{ id: 'a', name: 'Half', sortOrder: 0 }, { id: 'b', name: 'Full', sortOrder: 1 }], [
    { variantId: 'a', priceInr: 80 },
    { variantId: 'b', priceInr: 150 },
  ]);
  if (!fields.isMultiPriced || fields.displayPriceInr !== 80 || fields.maxPriceInr !== 150) {
    throw new Error('menu-pricing.util self-check failed');
  }
}
