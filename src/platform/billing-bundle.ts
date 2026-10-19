import { BillingProduct } from './enums/billing-product.enum';

export const ALL_BILLING_PRODUCTS: BillingProduct[] = [
  BillingProduct.QUICK_REVIEW,
  BillingProduct.QUICK_MENU,
  BillingProduct.QUICK_CONNECT,
  BillingProduct.QUICK_DESIGN,
  BillingProduct.QUICK_SCAN,
  BillingProduct.QUICK_CRM,
];

export const FULL_SUITE_PRODUCT_COUNT = ALL_BILLING_PRODUCTS.length;
export const FULL_SUITE_DISCOUNT_RATE = 0.3;

export type CheckoutPlanLine = { product: BillingProduct; amountInr: number };

export type CheckoutTotals = {
  subtotalInr: number;
  discountInr: number;
  totalInr: number;
  perPlanAmounts: number[];
};

export function computeCheckoutTotals(plans: CheckoutPlanLine[]): CheckoutTotals {
  const subtotalInr = plans.reduce((sum, p) => sum + p.amountInr, 0);
  const fullSuite =
    plans.length === FULL_SUITE_PRODUCT_COUNT &&
    new Set(plans.map((p) => p.product)).size === FULL_SUITE_PRODUCT_COUNT;

  if (!fullSuite || subtotalInr <= 0) {
    return {
      subtotalInr,
      discountInr: 0,
      totalInr: subtotalInr,
      perPlanAmounts: plans.map((p) => p.amountInr),
    };
  }

  const totalInr = Math.round(subtotalInr * (1 - FULL_SUITE_DISCOUNT_RATE));
  const discountInr = subtotalInr - totalInr;
  const perPlanAmounts = allocateProportionalInr(
    plans.map((p) => p.amountInr),
    totalInr,
  );
  return { subtotalInr, discountInr, totalInr, perPlanAmounts };
}

/** Split totalInr across weights; last line absorbs rounding so sum equals totalInr. */
function allocateProportionalInr(weights: number[], totalInr: number): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      out.push(totalInr - allocated);
    } else {
      const share = Math.floor((weights[i]! * totalInr) / weightSum);
      out.push(share);
      allocated += share;
    }
  }
  return out;
}
