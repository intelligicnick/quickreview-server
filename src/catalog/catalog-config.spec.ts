import { BusinessCategory } from './business-category.enum';
import { catalogCopyForLocation, catalogTypeForCategory, menuModeForCategory } from './catalog-config';
import { CatalogType } from './catalog-type.enum';
import { LocationMenuMode } from '../locations/location-menu-mode.enum';

const jewellery = catalogCopyForLocation(BusinessCategory.JEWELLERY, LocationMenuMode.SHOP);
if (jewellery.productName !== 'Catalogue' || jewellery.showVegBadge !== false) {
  throw new Error('jewellery copy mismatch');
}
if (catalogTypeForCategory(BusinessCategory.JEWELLERY) !== CatalogType.CATALOGUE) {
  throw new Error('jewellery catalog type mismatch');
}
if (menuModeForCategory(BusinessCategory.RESTAURANT) !== LocationMenuMode.FOOD) {
  throw new Error('restaurant menu mode mismatch');
}
