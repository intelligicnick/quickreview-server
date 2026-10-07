import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BillingProduct } from './enums/billing-product.enum';
import { MarketplaceCategory } from './entities/marketplace-category.entity';
import { Plan } from './entities/plan.entity';
import { QrProduct } from './entities/qr-product.entity';

const DEFAULT_PLANS: Array<Pick<Plan, 'code' | 'name' | 'product' | 'amountInr' | 'durationDays' | 'sortOrder'>> =
  [
    {
      code: 'quickreview_trial',
      name: 'QuickReview trial',
      product: BillingProduct.QUICK_REVIEW,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 1,
    },
    {
      code: 'quickreview_monthly',
      name: 'QuickReview monthly',
      product: BillingProduct.QUICK_REVIEW,
      amountInr: 499,
      durationDays: 30,
      sortOrder: 2,
    },
    {
      code: 'quickmenu_trial',
      name: 'Quick Commerce trial',
      product: BillingProduct.QUICK_MENU,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 3,
    },
    {
      code: 'quickmenu_monthly',
      name: 'Quick Commerce monthly',
      product: BillingProduct.QUICK_MENU,
      amountInr: 399,
      durationDays: 30,
      sortOrder: 6,
    },
    {
      code: 'quickconnect_trial',
      name: 'QuickConnect trial',
      product: BillingProduct.QUICK_CONNECT,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 4,
    },
    {
      code: 'quickconnect_monthly',
      name: 'QuickConnect monthly',
      product: BillingProduct.QUICK_CONNECT,
      amountInr: 299,
      durationDays: 30,
      sortOrder: 5,
    },
    {
      code: 'quickdesign_trial',
      name: 'QuickDesign trial',
      product: BillingProduct.QUICK_DESIGN,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 7,
    },
    {
      code: 'quickdesign_monthly',
      name: 'QuickDesign monthly',
      product: BillingProduct.QUICK_DESIGN,
      amountInr: 499,
      durationDays: 30,
      sortOrder: 8,
    },
    {
      code: 'quickscan_trial',
      name: 'QuickScan trial',
      product: BillingProduct.QUICK_SCAN,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 9,
    },
    {
      code: 'quickscan_monthly',
      name: 'QuickScan monthly',
      product: BillingProduct.QUICK_SCAN,
      amountInr: 399,
      durationDays: 30,
      sortOrder: 10,
    },
    {
      code: 'quickcrm_trial',
      name: 'Quick CRM trial',
      product: BillingProduct.QUICK_CRM,
      amountInr: 0,
      durationDays: 7,
      sortOrder: 11,
    },
    {
      code: 'quickcrm_monthly',
      name: 'Quick CRM monthly',
      product: BillingProduct.QUICK_CRM,
      amountInr: 299,
      durationDays: 30,
      sortOrder: 12,
    },
  ];

const DEFAULT_MARKETPLACE_CATEGORIES: Array<Pick<MarketplaceCategory, 'name' | 'sortOrder'>> = [
  { name: 'Standees', sortOrder: 1 },
  { name: 'Cards & NFC', sortOrder: 2 },
];

type ProductSeed = Pick<
  QrProduct,
  'name' | 'description' | 'dimensions' | 'priceInr' | 'sortOrder'
> & { categoryName: string };

const DEFAULT_QR_PRODUCTS: ProductSeed[] = [
  {
    name: 'Acrylic standee — Review QR',
    description: 'Pre-printed standee wired to your review page.',
    dimensions: '4×6 in',
    priceInr: 349,
    sortOrder: 1,
    categoryName: 'Standees',
  },
  {
    name: 'Acrylic standee — Menu QR',
    description: 'Menu or catalogue QR for tables and counters.',
    dimensions: '4×6 in',
    priceInr: 349,
    sortOrder: 2,
    categoryName: 'Standees',
  },
  {
    name: 'NFC review card',
    description: 'Tap-to-review card paired with your location.',
    dimensions: 'CR80',
    priceInr: 499,
    sortOrder: 3,
    categoryName: 'Cards & NFC',
  },
];

@Injectable()
export class PlatformBootstrap implements OnModuleInit {
  private readonly logger = new Logger(PlatformBootstrap.name);

  constructor(
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(QrProduct) private readonly qrProducts: Repository<QrProduct>,
    @InjectRepository(MarketplaceCategory) private readonly categories: Repository<MarketplaceCategory>,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.plans.find({ select: ['code'] });
    const codes = new Set(existing.map((row) => row.code));
    const missing = DEFAULT_PLANS.filter((seed) => !codes.has(seed.code));
    if (missing.length > 0) {
      await this.plans.save(missing.map((seed) => this.plans.create(seed)));
      this.logger.log(`Seeded ${missing.length} subscription plan(s)`);
    }

    const categoryByName = await this.ensureMarketplaceCategories();

    const productCount = await this.qrProducts.count();
    if (productCount === 0) {
      await this.qrProducts.save(
        DEFAULT_QR_PRODUCTS.map((seed) => {
          const { categoryName, ...product } = seed;
          return this.qrProducts.create({
            ...product,
            categoryId: categoryByName.get(categoryName)?.id ?? null,
          });
        }),
      );
      this.logger.log(`Seeded ${DEFAULT_QR_PRODUCTS.length} marketplace QR products`);
    } else {
      await this.backfillProductCategories(categoryByName);
    }
  }

  private async ensureMarketplaceCategories(): Promise<Map<string, MarketplaceCategory>> {
    const existing = await this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
    if (existing.length === 0) {
      await this.categories.save(
        DEFAULT_MARKETPLACE_CATEGORIES.map((seed) => this.categories.create(seed)),
      );
      this.logger.log(`Seeded ${DEFAULT_MARKETPLACE_CATEGORIES.length} marketplace categor(ies)`);
      const rows = await this.categories.find();
      return new Map(rows.map((row) => [row.name, row]));
    }
    return new Map(existing.map((row) => [row.name, row]));
  }

  private async backfillProductCategories(categoryByName: Map<string, MarketplaceCategory>): Promise<void> {
    const uncategorized = await this.qrProducts.find({ where: { categoryId: IsNull() } });
    if (uncategorized.length === 0) return;
    const standees = categoryByName.get('Standees');
    const cards = categoryByName.get('Cards & NFC');
    for (const product of uncategorized) {
      const lower = product.name.toLowerCase();
      if (lower.includes('nfc') || lower.includes('card')) {
        product.categoryId = cards?.id ?? standees?.id ?? null;
      } else {
        product.categoryId = standees?.id ?? null;
      }
    }
    await this.qrProducts.save(uncategorized);
  }
}
