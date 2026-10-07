import { LocationMenuMode } from '../locations/location-menu-mode.enum';

const FOOD_TYPES = new Set([
  'restaurant',
  'cafe',
  'bakery',
  'meal_takeaway',
  'meal_delivery',
  'bar',
  'food',
  'indian_restaurant',
  'fast_food_restaurant',
]);

const SERVICE_TYPES = new Set([
  'beauty_salon',
  'hair_care',
  'hair_salon',
  'spa',
  'nail_salon',
  'dentist',
  'doctor',
  'physiotherapist',
  'car_repair',
  'car_wash',
  'lawyer',
  'accounting',
  'real_estate_agency',
  'gym',
  'fitness_center',
]);

function normalizeType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function menuModeFromGoogleTypes(
  primaryType?: string | null,
  types?: string[] | null,
): LocationMenuMode {
  const candidates = [primaryType, ...(types ?? [])].filter(Boolean) as string[];
  for (const raw of candidates) {
    const t = normalizeType(raw);
    if (FOOD_TYPES.has(t) || t.includes('restaurant') || t.includes('food')) {
      return LocationMenuMode.FOOD;
    }
  }
  for (const raw of candidates) {
    const t = normalizeType(raw);
    if (SERVICE_TYPES.has(t) || t.includes('salon') || t.includes('clinic')) {
      return LocationMenuMode.SERVICES;
    }
  }
  return LocationMenuMode.SHOP;
}

export function categoryLabelFromTypes(
  primaryType?: string | null,
  primaryTypeDisplay?: string | null,
): string | null {
  if (primaryTypeDisplay?.trim()) return primaryTypeDisplay.trim();
  if (!primaryType?.trim()) return null;
  return primaryType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
