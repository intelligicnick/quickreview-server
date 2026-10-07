import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '../common/constants';
import type { GbpLocationRow, PlaceSnapshot } from './google.types';

type PlacesPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  error?: { message?: string };
};

const MOCK_PLACES: Record<string, PlaceSnapshot> = {
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
};

@Injectable()
export class GooglePlacesService {
  constructor(private readonly config: ConfigService) {}

  isMockMode(): boolean {
    return this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() === 'mock';
  }

  isConfigured(): boolean {
    return this.isMockMode() || Boolean(this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim());
  }

  async searchText(query: string): Promise<PlaceSnapshot[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];
    if (this.isMockMode()) {
      const q = trimmed.toLowerCase();
      const fromCatalog = Object.values(MOCK_PLACES).filter(
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
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'GOOGLE_MAPS_API_KEY is not configured',
      });
    }
    let response: Response;
    try {
      response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount',
        },
        body: JSON.stringify({
          textQuery: trimmed,
          pageSize: 10,
          languageCode: this.config.get<string>('GOOGLE_PLACES_LANGUAGE')?.trim() || 'en',
          regionCode: this.config.get<string>('GOOGLE_PLACES_REGION')?.trim() || 'IN',
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Places search failed';
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      });
    }
    const body = (await response.json()) as { places?: PlacesPlace[]; error?: { message?: string } };
    if (!response.ok) {
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: body.error?.message ?? `Places search failed (${response.status})`,
      });
    }
    return (body.places ?? [])
      .map((place) => this.toSnapshot(place))
      .filter((row): row is PlaceSnapshot => Boolean(row));
  }

  async fetchPlaceDetails(placeId: string): Promise<PlaceSnapshot> {
    const normalized = placeId.trim();
    if (this.isMockMode()) {
      const mock = MOCK_PLACES[normalized];
      if (mock) return mock;
      if (normalized.startsWith('ChIJMOCK')) {
        return {
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
        };
      }
      throw new BadGatewayException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Unknown mock place id',
      });
    }
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'GOOGLE_MAPS_API_KEY is not configured',
      });
    }
    const resource = normalized.startsWith('places/') ? normalized : `places/${normalized}`;
    let response: Response;
    try {
      response = await fetch(`https://places.googleapis.com/v1/${resource}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,primaryType,primaryTypeDisplayName,types,rating,userRatingCount',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Places request failed';
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      });
    }
    const body = (await response.json()) as PlacesPlace;
    if (!response.ok) {
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: body.error?.message ?? `Places API returned ${response.status}`,
      });
    }
    const snapshot = this.toSnapshot(body);
    if (!snapshot) {
      throw new BadGatewayException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Places API returned incomplete data',
      });
    }
    return snapshot;
  }

  snapshotFromGbp(row: GbpLocationRow): PlaceSnapshot | null {
    if (!row.placeId) return null;
    return {
      placeId: row.placeId,
      name: row.title,
      formattedAddress: row.formattedAddress,
      phone: row.phone,
      website: row.website,
      primaryType: row.primaryCategory,
      primaryTypeDisplay: row.primaryCategory,
      types: row.primaryCategory ? [row.primaryCategory] : [],
      rating: null,
      reviewCount: null,
    };
  }

  private toSnapshot(place: PlacesPlace): PlaceSnapshot | null {
    const placeId = place.id?.replace(/^places\//, '') ?? '';
    const name = place.displayName?.text?.trim();
    if (!placeId || !name) return null;
    return {
      placeId,
      name,
      formattedAddress: place.formattedAddress?.trim() || null,
      phone: place.nationalPhoneNumber?.trim() || null,
      website: place.websiteUri?.trim() || null,
      primaryType: place.primaryType?.trim() || null,
      primaryTypeDisplay: place.primaryTypeDisplayName?.trim() || null,
      types: place.types ?? [],
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    };
  }
}
