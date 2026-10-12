import { BusinessCategory } from '../catalog/business-category.enum';

export type ReviewAiPreset = {
  label: string;
  questions: string[];
  keywords: string[];
};

const UNIVERSAL: ReviewAiPreset = {
  label: 'General (works for most businesses)',
  questions: [
    'What did we do well for you?',
    'What mattered most about your experience? (optional)',
    'Who would you recommend us to? (optional)',
  ],
  keywords: ['clear communication', 'quality work', 'friendly team', 'good value'],
};

const BY_CATEGORY: Partial<Record<BusinessCategory, ReviewAiPreset>> = {
  [BusinessCategory.RESTAURANT]: {
    label: 'Restaurant / café',
    questions: [
      'What did you enjoy eating or drinking?',
      'What stood out about the food or service? (optional)',
      'Who should try this place? (optional)',
    ],
    keywords: ['tasty food', 'fresh ingredients', 'quick service', 'warm ambience'],
  },
  [BusinessCategory.BAKERY]: {
    label: 'Bakery',
    questions: [
      'What did you try and like?',
      'What stood out — taste, freshness, or service? (optional)',
      'Who would love this bakery? (optional)',
    ],
    keywords: ['fresh baked', 'great taste', 'clean shop', 'friendly staff'],
  },
  [BusinessCategory.BEAUTY]: {
    label: 'Salon / beauty',
    questions: [
      'What service did you get and how was the result?',
      'What stood out about the stylist or salon? (optional)',
      'Who should book here? (optional)',
    ],
    keywords: ['skilled stylist', 'hygienic', 'great results', 'relaxing visit'],
  },
  [BusinessCategory.SERVICES]: {
    label: 'Professional services',
    questions: [
      'What did we help you with or deliver?',
      'What made working with us easy or effective? (optional)',
      'Who should contact us for similar needs? (optional)',
    ],
    keywords: ['clear communication', 'on-time delivery', 'expert advice', 'trustworthy team'],
  },
  [BusinessCategory.ELECTRONICS]: {
    label: 'Electronics',
    questions: [
      'What did you buy or get repaired?',
      'What stood out — product, price, or support? (optional)',
      'Who should shop here? (optional)',
    ],
    keywords: ['genuine products', 'helpful staff', 'fair pricing', 'after-sales support'],
  },
  [BusinessCategory.PHARMACY]: {
    label: 'Pharmacy',
    questions: [
      'What did you need help with today?',
      'What stood out about the staff or service? (optional)',
      'Who should use this pharmacy? (optional)',
    ],
    keywords: ['helpful pharmacist', 'stock availability', 'quick billing', 'clean store'],
  },
  [BusinessCategory.JEWELLERY]: {
    label: 'Jewellery',
    questions: [
      'What did you see or purchase?',
      'What stood out about the designs or service? (optional)',
      'Who should visit for jewellery? (optional)',
    ],
    keywords: ['beautiful designs', 'transparent pricing', 'trusted jeweller', 'polite staff'],
  },
  [BusinessCategory.GROCERY]: {
    label: 'Grocery',
    questions: [
      'What did you shop for today?',
      'What stood out — variety, freshness, or billing? (optional)',
      'Who should shop here? (optional)',
    ],
    keywords: ['fresh produce', 'good variety', 'fair prices', 'quick checkout'],
  },
};

export function reviewAiPresetForCategory(
  category: BusinessCategory | null | undefined,
): ReviewAiPreset {
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category]!;
  return UNIVERSAL;
}
