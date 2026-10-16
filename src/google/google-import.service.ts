import { Injectable, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants';
import { googleWriteReviewUrl } from '../common/utils/review-code';
import { BusinessesService } from '../businesses/businesses.service';
import { Location } from '../locations/location.entity';
import { User } from '../users/user.entity';
import { ImportGoogleDto } from './dto/google.dto';
import { GoogleLocationFromPlaceService } from './google-location-from-place.service';
import { GooglePlacesService } from './google-places.service';
import { categoryLabelFromTypes } from './menu-mode.util';
import type { PlaceSnapshot } from './google.types';

@Injectable()
export class GoogleImportService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly places: GooglePlacesService,
    private readonly locationFromPlace: GoogleLocationFromPlaceService,
  ) {}

  async importFromGoogle(user: User, dto: ImportGoogleDto) {
    if (!dto.items?.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Select at least one location to import',
      });
    }

    const resolved: Array<{ snapshot: PlaceSnapshot; gbpLocationName: string | null }> = [];
    for (const item of dto.items) {
      const placeId = item.placeId.trim();
      let snapshot = await this.places.fetchPlaceDetails(placeId);
      if (item.title?.trim()) {
        snapshot = { ...snapshot, name: item.title.trim() };
      }
      await this.locationFromPlace.assertPlaceAvailable(placeId);
      resolved.push({
        snapshot,
        gbpLocationName: item.gbpLocationName?.trim() || null,
      });
    }

    const lead = resolved[0].snapshot;
    const businessName =
      dto.businessName?.trim() ||
      (resolved.length === 1 ? lead.name : lead.name.split('·')[0]?.trim() || lead.name);

    const business = await this.businessesService.create(user, {
      name: businessName,
      category: categoryLabelFromTypes(lead.primaryType, lead.primaryTypeDisplay) ?? undefined,
      phone: lead.phone ?? undefined,
      email: undefined,
      website: lead.website ?? undefined,
      address: lead.formattedAddress ?? undefined,
      googleReviewUrl: googleWriteReviewUrl(lead.placeId),
    });

    const created: Location[] = [];
    for (const row of resolved) {
      const location = await this.locationFromPlace.createLocationFromPlace(
        user,
        business.id,
        row.snapshot,
        row.gbpLocationName,
      );
      created.push(location);
    }

    return {
      business,
      locations: created,
    };
  }
}
