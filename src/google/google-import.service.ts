import {
  ConflictException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { googleWriteReviewUrl } from '../common/utils/review-code';
import { BusinessesService } from '../businesses/businesses.service';
import { Location } from '../locations/location.entity';
import { LocationStatus } from '../locations/location-status.enum';
import { MembersService } from '../members/members.service';
import { ReviewService } from '../review/review.service';
import { User } from '../users/user.entity';
import { ImportGoogleDto } from './dto/google.dto';
import { GooglePlacesService } from './google-places.service';
import { categoryLabelFromTypes, menuModeFromGoogleTypes } from './menu-mode.util';
import type { PlaceSnapshot } from './google.types';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class GoogleImportService {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly places: GooglePlacesService,
    private readonly reviewService: ReviewService,
    private readonly members: MembersService,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
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
      await this.assertPlaceAvailable(placeId);
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
      const location = await this.createLocation(user, business.id, row.snapshot, row.gbpLocationName);
      created.push(location);
    }

    return {
      business,
      locations: created,
    };
  }

  private async assertPlaceAvailable(placeId: string): Promise<void> {
    const existing = await this.locations.findOne({
      where: { googlePlaceId: placeId },
    });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: 'This Google place is already linked to another QuickReview shop',
      });
    }
  }

  private async createLocation(
    user: User,
    businessId: string,
    snapshot: PlaceSnapshot,
    gbpLocationName: string | null,
  ): Promise<Location> {
    await this.members.assertMember(user, businessId);
    const menuMode = menuModeFromGoogleTypes(snapshot.primaryType, snapshot.types);
    const location = this.locations.create({
      businessId,
      name: snapshot.name,
      address: snapshot.formattedAddress,
      phone: snapshot.phone,
      email: null,
      googleReviewUrl: googleWriteReviewUrl(snapshot.placeId),
      googlePlaceId: snapshot.placeId,
      gbpLocationName,
      menuMode,
      reviewCode: await this.reviewService.allocateCode(),
      slug: await this.uniqueSlug(snapshot.name),
      status: LocationStatus.ACTIVE,
      metricsRefreshedAt:
        snapshot.rating != null ? new Date() : null,
    });
    return this.locations.save(location);
  }

  private async uniqueSlug(name: string): Promise<string | null> {
    const base = slugify(name);
    if (!base) return null;
    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await this.locations.exist({ where: { slug: candidate } });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
