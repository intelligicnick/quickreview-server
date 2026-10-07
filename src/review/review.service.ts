import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import {
  googleWriteReviewUrl,
  newReviewCode,
  parseGooglePlaceId,
} from '../common/utils/review-code';
import { Location } from '../locations/location.entity';
import { LocationStatus } from '../locations/location-status.enum';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { User } from '../users/user.entity';
import { UpdateReviewSettingsDto } from './dto/review-settings.dto';
import { RecordReviewEventDto } from './dto/public-review.dto';
import { LocationReviewSettings } from './location-review-settings.entity';
import { ReviewDraftService } from './review-draft.service';
import { ReviewEventKind } from './review-event-kind.enum';
import { ReviewEvent } from './review-event.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    @InjectRepository(ReviewEvent)
    private readonly events: Repository<ReviewEvent>,
    @InjectRepository(LocationReviewSettings)
    private readonly reviewSettings: Repository<LocationReviewSettings>,
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly drafts: ReviewDraftService,
  ) {}

  async allocateCode(): Promise<string> {
    return this.uniqueCode();
  }

  async ensureReviewCode(location: Location): Promise<Location> {
    if (location.reviewCode) return location;
    location.reviewCode = await this.uniqueCode();
    return this.locations.save(location);
  }

  async findByReviewCode(code: string): Promise<Location> {
    const normalized = code.trim().toUpperCase();
    const location = await this.locations.findOne({
      where: { reviewCode: normalized },
      relations: { business: true },
    });
    if (!location || location.status !== LocationStatus.ACTIVE) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Review page not found',
      });
    }
    return location;
  }

  async getPublicPage(code: string) {
    const location = await this.findByReviewCode(code);
    await this.assertQuickReviewLive(location.id);
    await this.record(location.id, ReviewEventKind.PAGE_VIEW, null, null);
    const placeId = location.googlePlaceId ?? parseGooglePlaceId(location.googleReviewUrl);
    return {
      code: location.reviewCode,
      name: location.name,
      address: location.address,
      category: location.business?.category ?? null,
      googlePlaceId: placeId,
      googleReviewUrl: placeId ? googleWriteReviewUrl(placeId) : null,
    };
  }

  async recordPublicEvent(code: string, dto: RecordReviewEventDto) {
    const location = await this.findByReviewCode(code);
    await this.assertQuickReviewLive(location.id);

    if (dto.type === 'page_view') {
      await this.record(location.id, ReviewEventKind.PAGE_VIEW, null, null);
      return { recorded: true };
    }

    const stars = dto.stars;
    if (dto.type === 'star') {
      if (!stars) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Star rating is required',
        });
      }
      await this.record(location.id, ReviewEventKind.STAR, stars, null);
      return { recorded: true };
    }

    if (dto.type === 'private') {
      if (!stars || stars > 3) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Private feedback is only for 1–3 star ratings',
        });
      }
      const message = dto.message?.trim();
      if (!message || message.length < 3) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Please share a short message',
        });
      }
      await this.record(location.id, ReviewEventKind.PRIVATE_FEEDBACK, stars, message);
      return { recorded: true };
    }

    if (dto.type === 'google_open') {
      if (!stars || stars < 4) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Google redirect applies to 4–5 star ratings',
        });
      }
      await this.record(location.id, ReviewEventKind.GOOGLE_OPEN, stars, null);
      return { recorded: true };
    }

    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Unknown event type',
    });
  }

  async suggestPublicDrafts(code: string, stars: number) {
    const location = await this.findByReviewCode(code);
    await this.assertQuickReviewLive(location.id);
    const keywords = await this.keywordsForLocation(location.id);
    const suggestions = await this.drafts.suggestDrafts(location, stars, keywords);
    return { suggestions };
  }

  async getReviewSettings(user: User, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.members.assertMember(user, location.businessId);
    const row = await this.ensureSettingsRow(locationId);
    return { locationId, keywords: row.keywords ?? [] };
  }

  async updateReviewSettings(user: User, locationId: string, dto: UpdateReviewSettingsDto) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);
    const row = await this.ensureSettingsRow(locationId);
    if (dto.keywords !== undefined) {
      row.keywords = dto.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12);
    }
    await this.reviewSettings.save(row);
    return { locationId, keywords: row.keywords };
  }

  async merchantSummary(user: User, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.members.assertMember(user, location.businessId);
    const withCode = await this.ensureReviewCode(location);
    const placeId = withCode.googlePlaceId ?? parseGooglePlaceId(withCode.googleReviewUrl);
    const settings = await this.ensureSettingsRow(locationId);

    const [pageViews, stars, privateCount, googleOpens, reviewAccess] = await Promise.all([
      this.countKind(locationId, ReviewEventKind.PAGE_VIEW),
      this.countKind(locationId, ReviewEventKind.STAR),
      this.countKind(locationId, ReviewEventKind.PRIVATE_FEEDBACK),
      this.countKind(locationId, ReviewEventKind.GOOGLE_OPEN),
      this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_REVIEW),
    ]);

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    const publicPath = `/r/${withCode.reviewCode}`;

    return {
      locationId: withCode.id,
      reviewCode: withCode.reviewCode,
      publicPath,
      publicUrl: `${appUrl.replace(/\/$/, '')}${publicPath}`,
      googlePlaceId: placeId,
      googleReviewUrl: placeId ? googleWriteReviewUrl(placeId) : null,
      reviewUnlocked: reviewAccess.unlocked,
      reviewAccess,
      aiKeywords: settings.keywords ?? [],
      stats: {
        pageViews,
        stars,
        privateFeedback: privateCount,
        googleOpens,
      },
    };
  }

  async listInbox(user: User, locationId: string, limit = 50) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.members.assertMember(user, location.businessId);
    const rows = await this.events.find({
      where: { locationId, kind: ReviewEventKind.PRIVATE_FEEDBACK },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      stars: row.stars,
      message: row.message,
      createdAt: row.createdAt,
    }));
  }

  private async keywordsForLocation(locationId: string): Promise<string[]> {
    const row = await this.reviewSettings.findOne({ where: { locationId } });
    return row?.keywords ?? [];
  }

  private async ensureSettingsRow(locationId: string): Promise<LocationReviewSettings> {
    let row = await this.reviewSettings.findOne({ where: { locationId } });
    if (row) return row;
    row = this.reviewSettings.create({ locationId, keywords: [] });
    return this.reviewSettings.save(row);
  }

  private async assertQuickReviewLive(locationId: string): Promise<void> {
    const live = await this.subscriptions.hasActiveProduct(
      locationId,
      BillingProduct.QUICK_REVIEW,
    );
    if (!live) {
      throw new HttpException(
        {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message:
            'This review page is locked until QuickReview is activated for this shop. Choose a plan in your dashboard.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private async record(
    locationId: string,
    kind: ReviewEventKind,
    stars: number | null,
    message: string | null,
  ) {
    await this.events.save(
      this.events.create({
        locationId,
        kind,
        stars,
        message,
      }),
    );
  }

  private async countKind(locationId: string, kind: ReviewEventKind): Promise<number> {
    return this.events.count({ where: { locationId, kind } });
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = newReviewCode();
      const exists = await this.locations.exist({ where: { reviewCode: code } });
      if (!exists) return code;
    }
    return newReviewCode(10);
  }

  applyGoogleFields(
    location: Location,
    googleReviewUrl?: string | null,
    googlePlaceId?: string | null,
  ): void {
    if (googleReviewUrl !== undefined) {
      location.googleReviewUrl = googleReviewUrl?.trim() || null;
      const parsed = parseGooglePlaceId(location.googleReviewUrl);
      if (parsed) location.googlePlaceId = parsed;
    }
    if (googlePlaceId !== undefined) {
      const trimmed = googlePlaceId?.trim() || null;
      if (trimmed) location.googlePlaceId = trimmed;
    }
  }
}
