import { BillingProduct } from './enums/billing-product.enum';
import { ALL_BILLING_PRODUCTS, computeCheckoutTotals } from './billing-bundle';

describe('computeCheckoutTotals', () => {
  it('applies 30% off when all six products are included', () => {
    const plans = ALL_BILLING_PRODUCTS.map((product) => ({ product, amountInr: 100 }));
    const t = computeCheckoutTotals(plans);
    expect(t.subtotalInr).toBe(600);
    expect(t.totalInr).toBe(420);
    expect(t.discountInr).toBe(180);
    expect(t.perPlanAmounts.reduce((a, b) => a + b, 0)).toBe(t.totalInr);
  });

  it('does not discount partial bundles', () => {
    const t = computeCheckoutTotals([
      { product: BillingProduct.QUICK_REVIEW, amountInr: 499 },
      { product: BillingProduct.QUICK_MENU, amountInr: 399 },
    ]);
    expect(t.discountInr).toBe(0);
    expect(t.totalInr).toBe(898);
  });
});
