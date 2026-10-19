import type { PlaceSnapshot } from './google.types';

export function isGoogleMapsMockApiKey(apiKey: string | undefined | null): boolean {
  return apiKey?.trim() === 'mock';
}

/** Fixed catalog for e2e and local dev (`GOOGLE_MAPS_API_KEY=mock`). */
export const MOCK_GOOGLE_PLACES: Record<string, PlaceSnapshot> = {
  ChIJMOCKPATEL001: {
    placeId: 'ChIJMOCKPATEL001',
    name: 'Patel Jewellers',
    formattedAddress: 'Panvel, Maharashtra, India',
    phone: '+912231040000',
    website: 'https://example.com',
    primaryType: 'jewelry_store',
    primaryTypeDisplay: 'Jewelry store',
    types: ['jewelry_store', 'store'],
    rating: 4.9,
    reviewCount: 24024,
  },
  ChIJMOCKCAFE002: {
    placeId: 'ChIJMOCKCAFE002',
    name: 'Mock Street Cafe',
    formattedAddress: 'Bandra West, Mumbai, Maharashtra, India',
    phone: '+912240000001',
    website: null,
    primaryType: 'cafe',
    primaryTypeDisplay: 'Cafe',
    types: ['cafe', 'food'],
    rating: 4.6,
    reviewCount: 312,
  },
};

export type MockPlaceDetailsResult =
  | { ok: true; place: PlaceSnapshot }
  | { ok: false; reason: 'unknown' };

export function mockPlacesTextSearch(query: string): PlaceSnapshot[] {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const q = trimmed.toLowerCase();
  const fromCatalog = Object.values(MOCK_GOOGLE_PLACES).filter(
    (row) =>
      row.name.toLowerCase().includes(q) ||
      row.formattedAddress?.toLowerCase().includes(q),
  );
  if (fromCatalog.length > 0) return fromCatalog;
  return [
    {
      placeId: `ChIJMOCK${Buffer.from(trimmed).toString('base64url').slice(0, 12)}`,
      name: trimmed,
      formattedAddress: 'India (mock result — set a real GOOGLE_MAPS_API_KEY for live search)',
      phone: null,
      website: null,
      primaryType: 'store',
      primaryTypeDisplay: 'Store',
      types: ['store'],
      rating: 4.5,
      reviewCount: 100,
    },
  ];
}

export function mockPlaceDetails(placeId: string): MockPlaceDetailsResult {
  const normalized = placeId.trim();
  const catalog = MOCK_GOOGLE_PLACES[normalized];
  if (catalog) return { ok: true, place: catalog };
  if (normalized.startsWith('ChIJMOCK')) {
    return {
      ok: true,
      place: {
        placeId: normalized,
        name: 'Google listing',
        formattedAddress: 'India (mock — use a real GOOGLE_MAPS_API_KEY for live data)',
        phone: null,
        website: null,
        primaryType: 'store',
        primaryTypeDisplay: 'Store',
        types: ['store'],
        rating: null,
        reviewCount: null,
      },
    };
  }
  return { ok: false, reason: 'unknown' };
}

if (require.main === module) {
  const hits = mockPlacesTextSearch('Patel');
  console.assert(hits[0]?.placeId === 'ChIJMOCKPATEL001', 'catalog search');
  console.assert(mockPlaceDetails('ChIJMOCKCAFE002').ok, 'catalog details');
  console.assert(!mockPlaceDetails('ChIJREALUNKNOWN').ok, 'unknown id');
}
