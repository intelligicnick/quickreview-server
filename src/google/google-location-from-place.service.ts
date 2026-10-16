import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { googleWriteReviewUrl } from '../common/utils/review-code';
import { Location } from '../locations/location.entity';
import { LocationStatus } from '../locations/location-status.enum';
import { MembersService } from '../members/members.service';
import { ReviewService } from '../review/review.service';
import { User } from '../users/user.entity';
import { GoogleReviewGrowthService } from './google-review-growth.service';
import { menuModeFromGoogleTypes } from './menu-mode.util';
import type { PlaceSnapshot } from './google.types';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

@Injectable()
export class GoogleLocationFromPlaceService {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewGrowth: GoogleReviewGrowthService,
    private readonly members: MembersService,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
  ) {}

  async assertPlaceAvailable(placeId: string): Promise<void> {
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

  async createLocationFromPlace(
    user: User,
    businessId: string,
    snapshot: PlaceSnapshot,
    gbpLocationName: string | null = null,
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
      metricsRefreshedAt: snapshot.rating != null ? new Date() : null,
    });
    const saved = await this.locations.save(location);
    if (snapshot.reviewCount != null) {
      await this.reviewGrowth.recordCount(saved.id, snapshot.reviewCount);
    }
    return saved;
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
