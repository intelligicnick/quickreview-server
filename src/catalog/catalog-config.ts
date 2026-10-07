import { LocationMenuMode } from '../locations/location-menu-mode.enum';
import { BusinessCategory } from './business-category.enum';
import { CatalogType } from './catalog-type.enum';

export type CatalogTabId =
  | 'primary'
  | 'bundles'
  | 'featured'
  | 'unavailable'
  | 'qr'
  | 'import';

export type CatalogTabConfig = {
  id: CatalogTabId;
  label: string;
  enabled: boolean;
};

export type CatalogPresentation = 'menu' | 'catalogue' | 'grid' | 'list' | 'services';

export type CatalogCopy = {
  productName: string;
  moduleSubtitle: string;
  pageTitle: string;
  categoryLabel: string;
  categoryLabelPlural: string;
  itemLabel: string;
  itemLabelPlural: string;
  addCategory: string;
  addItem: string;
  emptyHint: string;
  unavailableTab: string;
  unavailableItem: string;
  showVegBadge: boolean;
  tabs: CatalogTabConfig[];
  presentation: CatalogPresentation;
};

export type BusinessCategoryCard = {
  id: BusinessCategory;
  emoji: string;
  title: string;
  subtitle: string;
};

export const BUSINESS_CATEGORY_CARDS: BusinessCategoryCard[] = [
  { id: BusinessCategory.RESTAURANT, emoji: '🍽', title: 'Restaurant / Cafe', subtitle: 'Food & beverages' },
  { id: BusinessCategory.GROCERY, emoji: '🛒', title: 'Grocery', subtitle: 'Supermarket & kirana' },
  { id: BusinessCategory.JEWELLERY, emoji: '💎', title: 'Jewellers', subtitle: 'Gold, diamond & silver' },
  { id: BusinessCategory.FASHION, emoji: '👗', title: 'Fashion & Clothing', subtitle: 'Apparel & accessories' },
  { id: BusinessCategory.ELECTRONICS, emoji: '📱', title: 'Electronics', subtitle: 'Gadgets & appliances' },
  { id: BusinessCategory.BEAUTY, emoji: '💄', title: 'Beauty', subtitle: 'Salon & cosmetics' },
  { id: BusinessCategory.PHARMACY, emoji: '💊', title: 'Pharmacy', subtitle: 'Healthcare products' },
  { id: BusinessCategory.BAKERY, emoji: '🥐', title: 'Bakery', subtitle: 'Breads & confectionery' },
  { id: BusinessCategory.HOME_FURNITURE, emoji: '🏠', title: 'Home & Furniture', subtitle: 'Decor & furnishings' },
  { id: BusinessCategory.AUTOMOBILE, emoji: '🚗', title: 'Automobile', subtitle: 'Parts & accessories' },
  { id: BusinessCategory.SERVICES, emoji: '🛠', title: 'Services', subtitle: 'Appointments & packages' },
  { id: BusinessCategory.RETAIL, emoji: '🏪', title: 'Retail Store', subtitle: 'General retail' },
  { id: BusinessCategory.GENERAL, emoji: '📦', title: 'General Products', subtitle: 'Mixed catalogue' },
  { id: BusinessCategory.OTHER, emoji: '➕', title: 'Other', subtitle: 'Custom catalogue' },
];

const TAB = (
  id: CatalogTabId,
  label: string,
  enabled = true,
): CatalogTabConfig => ({ id, label, enabled });

function tabsFor(
  primary: string,
  bundles: { label: string; enabled?: boolean },
  featured: { label: string; enabled?: boolean },
  unavailable: string,
): CatalogTabConfig[] {
  return [
    TAB('primary', primary),
    TAB('bundles', bundles.label, bundles.enabled ?? true),
    TAB('featured', featured.label, featured.enabled ?? true),
    TAB('unavailable', unavailable),
    TAB('qr', 'QR & link'),
    TAB('import', 'Import bulk'),
  ];
}

const COPY_BY_CATEGORY: Record<BusinessCategory, CatalogCopy> = {
  [BusinessCategory.RESTAURANT]: {
    productName: 'Menu',
    moduleSubtitle: 'Build your menu, combos, and today\'s special.',
    pageTitle: 'Menu',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Dish',
    itemLabelPlural: 'Dishes',
    addCategory: 'Add category',
    addItem: 'Add item',
    emptyHint: 'Add categories and dishes — guests scan your QR to browse.',
    unavailableTab: 'Not available',
    unavailableItem: 'Not available',
    showVegBadge: true,
    presentation: 'menu',
    tabs: tabsFor('Menu', { label: 'Combos' }, { label: "Today's special" }, 'Not available'),
  },
  [BusinessCategory.BAKERY]: {
    productName: 'Menu',
    moduleSubtitle: 'Showcase breads, cakes, and daily bakes.',
    pageTitle: 'Menu',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Item',
    itemLabelPlural: 'Items',
    addCategory: 'Add category',
    addItem: 'Add item',
    emptyHint: 'Group your bakes so guests can order quickly.',
    unavailableTab: 'Not available',
    unavailableItem: 'Not available',
    showVegBadge: true,
    presentation: 'menu',
    tabs: tabsFor('Menu', { label: 'Combos', enabled: false }, { label: "Today's special" }, 'Not available'),
  },
  [BusinessCategory.GROCERY]: {
    productName: 'Products',
    moduleSubtitle: 'Organise aisles and product listings.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Create categories like Fruits, Dairy, and Snacks.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'list',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.JEWELLERY]: {
    productName: 'Catalogue',
    moduleSubtitle: 'Collections, designs, and precious pieces.',
    pageTitle: 'Catalogue',
    categoryLabel: 'Collection',
    categoryLabelPlural: 'Collections',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add collection',
    addItem: 'Add product',
    emptyHint: 'Organise gold, diamond, and bridal collections.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'catalogue',
    tabs: tabsFor('Catalogue', { label: 'Collections', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.FASHION]: {
    productName: 'Products',
    moduleSubtitle: 'Show styles, sizes, and collections.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Group by Men, Women, Kids, or season.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'grid',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.ELECTRONICS]: {
    productName: 'Products',
    moduleSubtitle: 'List gadgets with specs and offers.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Group phones, laptops, and accessories.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'grid',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.PHARMACY]: {
    productName: 'Products',
    moduleSubtitle: 'Healthcare and wellness catalogue.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Organise medicines and wellness products.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'list',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.BEAUTY]: {
    productName: 'Services',
    moduleSubtitle: 'Services, packages, and retail add-ons.',
    pageTitle: 'Services',
    categoryLabel: 'Service category',
    categoryLabelPlural: 'Service categories',
    itemLabel: 'Service',
    itemLabelPlural: 'Services',
    addCategory: 'Add category',
    addItem: 'Add service',
    emptyHint: 'Group hair, skin, and spa services.',
    unavailableTab: 'Unavailable',
    unavailableItem: 'Currently unavailable',
    showVegBadge: false,
    presentation: 'services',
    tabs: tabsFor('Services', { label: 'Packages' }, { label: 'Offers' }, 'Unavailable'),
  },
  [BusinessCategory.HOME_FURNITURE]: {
    productName: 'Products',
    moduleSubtitle: 'Furniture and home decor catalogue.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Showcase rooms, materials, and collections.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'catalogue',
    tabs: tabsFor('Products', { label: 'Collections' }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.AUTOMOBILE]: {
    productName: 'Products',
    moduleSubtitle: 'Parts, accessories, and services.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Group parts by vehicle or brand.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'list',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.SERVICES]: {
    productName: 'Services',
    moduleSubtitle: 'Service categories, packages, and booking.',
    pageTitle: 'Services',
    categoryLabel: 'Service category',
    categoryLabelPlural: 'Service categories',
    itemLabel: 'Service',
    itemLabelPlural: 'Services',
    addCategory: 'Add category',
    addItem: 'Add service',
    emptyHint: 'Group services so clients can compare options.',
    unavailableTab: 'Unavailable',
    unavailableItem: 'Currently unavailable',
    showVegBadge: false,
    presentation: 'services',
    tabs: tabsFor('Services', { label: 'Packages' }, { label: 'Offers' }, 'Unavailable'),
  },
  [BusinessCategory.RETAIL]: {
    productName: 'Products',
    moduleSubtitle: 'Retail catalogue with categories and offers.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Organise shelves and collections for your store.',
    unavailableTab: 'Out of stock',
    unavailableItem: 'Out of stock',
    showVegBadge: false,
    presentation: 'grid',
    tabs: tabsFor('Products', { label: 'Categories', enabled: false }, { label: 'Offers' }, 'Out of stock'),
  },
  [BusinessCategory.GENERAL]: {
    productName: 'Products',
    moduleSubtitle: 'A flexible catalogue for any inventory.',
    pageTitle: 'Products',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Product',
    itemLabelPlural: 'Products',
    addCategory: 'Add category',
    addItem: 'Add product',
    emptyHint: 'Create categories and add products.',
    unavailableTab: 'Unavailable',
    unavailableItem: 'Unavailable',
    showVegBadge: false,
    presentation: 'grid',
    tabs: tabsFor('Products', { label: 'Collections', enabled: false }, { label: 'Offers' }, 'Unavailable'),
  },
  [BusinessCategory.OTHER]: {
    productName: 'Catalogue',
    moduleSubtitle: 'Your digital catalogue, your way.',
    pageTitle: 'Catalogue',
    categoryLabel: 'Category',
    categoryLabelPlural: 'Categories',
    itemLabel: 'Item',
    itemLabelPlural: 'Items',
    addCategory: 'Add category',
    addItem: 'Add item',
    emptyHint: 'Start with a category, then add items.',
    unavailableTab: 'Unavailable',
    unavailableItem: 'Unavailable',
    showVegBadge: false,
    presentation: 'grid',
    tabs: tabsFor('Catalogue', { label: 'Collections', enabled: false }, { label: 'Offers' }, 'Unavailable'),
  },
};

export function catalogTypeForCategory(category: BusinessCategory): CatalogType {
  switch (category) {
    case BusinessCategory.RESTAURANT:
    case BusinessCategory.BAKERY:
      return CatalogType.MENU;
    case BusinessCategory.JEWELLERY:
    case BusinessCategory.OTHER:
      return CatalogType.CATALOGUE;
    case BusinessCategory.SERVICES:
    case BusinessCategory.BEAUTY:
      return CatalogType.SERVICES;
    default:
      return CatalogType.PRODUCTS;
  }
}

export function menuModeForCategory(category: BusinessCategory): LocationMenuMode {
  switch (category) {
    case BusinessCategory.RESTAURANT:
    case BusinessCategory.BAKERY:
      return LocationMenuMode.FOOD;
    case BusinessCategory.SERVICES:
    case BusinessCategory.BEAUTY:
      return LocationMenuMode.SERVICES;
    default:
      return LocationMenuMode.SHOP;
  }
}

export function businessCategoryFromMenuMode(mode: LocationMenuMode): BusinessCategory {
  switch (mode) {
    case LocationMenuMode.SERVICES:
      return BusinessCategory.SERVICES;
    case LocationMenuMode.SHOP:
      return BusinessCategory.RETAIL;
    case LocationMenuMode.FOOD:
    default:
      return BusinessCategory.RESTAURANT;
  }
}

export function catalogCopyForLocation(
  businessCategory: BusinessCategory | null,
  menuMode: LocationMenuMode,
): CatalogCopy {
  const category = businessCategory ?? businessCategoryFromMenuMode(menuMode);
  return COPY_BY_CATEGORY[category];
}

/** Default size/portion columns for new menu categories (e.g. Half / Full). */
export type MenuImagePlaceholder = 'food' | 'bakery' | 'jewellery' | 'retail' | 'services';

export function menuImagePlaceholder(
  businessCategory: BusinessCategory | null,
  menuMode: LocationMenuMode,
): MenuImagePlaceholder {
  const category = businessCategory ?? businessCategoryFromMenuMode(menuMode);
  switch (category) {
    case BusinessCategory.RESTAURANT:
      return 'food';
    case BusinessCategory.BAKERY:
      return 'bakery';
    case BusinessCategory.JEWELLERY:
      return 'jewellery';
    case BusinessCategory.BEAUTY:
    case BusinessCategory.SERVICES:
      return 'services';
    default:
      return 'retail';
  }
}

export function defaultPriceVariantNames(
  businessCategory: BusinessCategory | null,
  menuMode: LocationMenuMode,
): string[] {
  if (!usesCategoryPriceVariants(businessCategory, menuMode)) return [];
  return ['Half', 'Full'];
}

/** Restaurant / bakery: shared Half–Full columns on the category. Everything else: per-product options. */
export function usesCategoryPriceVariants(
  businessCategory: BusinessCategory | null,
  menuMode: LocationMenuMode,
): boolean {
  const category = businessCategory ?? businessCategoryFromMenuMode(menuMode);
  return category === BusinessCategory.RESTAURANT || category === BusinessCategory.BAKERY;
}

export function catalogGuestBrowse(presentation: CatalogPresentation): boolean {
  return presentation === 'grid' || presentation === 'list' || presentation === 'catalogue';
}

/** @deprecated Use catalogCopyForLocation — kept for older imports */
export function menuModeCopy(mode: LocationMenuMode) {
  const copy = catalogCopyForLocation(null, mode);
  return {
    productName: copy.productName,
    pageTitle: copy.pageTitle,
    categoryLabel: copy.categoryLabel,
    itemLabel: copy.itemLabel,
    addCategory: copy.addCategory,
    addItem: copy.addItem,
    emptyHint: copy.emptyHint,
    showVegBadge: copy.showVegBadge,
  };
}
