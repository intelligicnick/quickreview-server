import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { googleWriteReviewUrl, parseGooglePlaceId } from '../common/utils/review-code';
import { Location } from '../locations/location.entity';
import { MembersService } from '../members/members.service';
import { User } from '../users/user.entity';
import { GooglePlacesService } from './google-places.service';
import { LocationGoogleReviewSnapshot } from './location-google-review-snapshot.entity';

export type ReviewGrowthRange = '7' | '30' | '90' | 'all';

export type ReviewGrowthPoint = {
  date: string;
  label: string;
  totalReviews: number;
  dayIncrement: number | null;
  isBaseline: boolean;
};

export type ReviewGrowthAnalytics = {
  trackingStartedAt: string | null;
  startedReviewCount: number | null;
  totalReviews: number | null;
  netGained: number | null;
  googleMapsUrl: string | null;
  googleReviewUrl: string | null;
  points: ReviewGrowthPoint[];
};

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function formatChartLabel(dateKey: string, baseline: boolean): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const short = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return baseline ? `Where you started · ${short}` : short;
}

@Injectable()
export class GoogleReviewGrowthService {
  constructor(
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    @InjectRepository(LocationGoogleReviewSnapshot)
    private readonly snapshots: Repository<LocationGoogleReviewSnapshot>,
    private readonly places: GooglePlacesService,
    private readonly members: MembersService,
  ) {}

  async recordCount(locationId: string, reviewCount: number, dateKey = utcDateKey()): Promise<void> {
    if (!Number.isFinite(reviewCount) || reviewCount < 0) return;
    const existing = await this.snapshots.findOne({
      where: { locationId, snapshotDate: dateKey },
    });
    if (existing) {
      existing.reviewCount = reviewCount;
      await this.snapshots.save(existing);
      return;
    }
    await this.snapshots.save(
      this.snapshots.create({ locationId, snapshotDate: dateKey, reviewCount }),
    );
  }

  async refreshTodaySnapshot(location: Location): Promise<number | null> {
    const placeId = location.googlePlaceId ?? parseGooglePlaceId(location.googleReviewUrl);
    if (!placeId || !this.places.isConfigured()) return null;
    try {
      const details = await this.places.fetchPlaceDetails(placeId);
      if (details.reviewCount == null) return null;
      await this.recordCount(location.id, details.reviewCount);
      return details.reviewCount;
    } catch {
      return null;
    }
  }

  async merchantGrowth(
    user: User,
    locationId: string,
    range: ReviewGrowthRange,
  ): Promise<ReviewGrowthAnalytics> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.members.assertMember(user, location.businessId);

    const placeId = location.googlePlaceId ?? parseGooglePlaceId(location.googleReviewUrl);
    const googleReviewUrl = placeId ? googleWriteReviewUrl(placeId) : null;
    const googleMapsUrl = placeId
      ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`
      : null;

    if (!placeId) {
      return {
        trackingStartedAt: null,
        startedReviewCount: null,
        totalReviews: null,
        netGained: null,
        googleMapsUrl: null,
        googleReviewUrl: null,
        points: [],
      };
    }

    await this.refreshTodaySnapshot(location);

    const rows = await this.snapshots.find({
      where: { locationId },
      order: { snapshotDate: 'ASC' },
    });

    if (!rows.length) {
      return {
        trackingStartedAt: null,
        startedReviewCount: null,
        totalReviews: null,
        netGained: null,
        googleMapsUrl,
        googleReviewUrl,
        points: [],
      };
    }

    const baseline = rows[0];
    const latest = rows[rows.length - 1];
    const rangeStartKey = range === 'all' ? null : utcDateKey(rangeStartDate(range));

    let series = rows;
    if (rangeStartKey) {
      const inRange = rows.filter((row) => row.snapshotDate >= rangeStartKey);
      if (inRange.length && inRange[0].snapshotDate > baseline.snapshotDate) {
        series = [baseline, ...inRange];
      } else {
        series = inRange.length ? inRange : [baseline];
      }
    }

    const points: ReviewGrowthPoint[] = series.map((row, index) => {
      const prev = index > 0 ? series[index - 1] : null;
      const dayIncrement = prev != null ? row.reviewCount - prev.reviewCount : null;
      const isBaseline = row.id === baseline.id;
      return {
        date: row.snapshotDate,
        label: formatChartLabel(row.snapshotDate, isBaseline),
        totalReviews: row.reviewCount,
        dayIncrement,
        isBaseline,
      };
    });

    const netGained = latest.reviewCount - baseline.reviewCount;

    return {
      trackingStartedAt: `${baseline.snapshotDate}T00:00:00.000Z`,
      startedReviewCount: baseline.reviewCount,
      totalReviews: latest.reviewCount,
      netGained,
      googleMapsUrl,
      googleReviewUrl,
      points,
    };
  }
}

function rangeStartDate(range: ReviewGrowthRange): Date {
  const days = range === '7' ? 7 : range === '30' ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}
