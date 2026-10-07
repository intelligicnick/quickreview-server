import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, MoreThanOrEqual } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { newReviewCode } from '../common/utils/review-code';
import { commerceHubPublicFullUrl, commerceHubPublicPath } from '../menu/menu.util';
import { Location } from '../locations/location.entity';
import { LocationStatus } from '../locations/location-status.enum';
import { MANAGER_ROLES, MemberRole } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { QrCode } from '../platform/entities/qr-code.entity';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { User } from '../users/user.entity';
import { RevisitCheckInDto } from './dto/public-revisit.dto';
import {
  RevisitRewardInputDto,
  UpdateRevisitRewardsDto,
  UpdateRevisitSettingsDto,
} from './dto/revisit-settings.dto';
import { LocationRevisitSettings } from './location-revisit-settings.entity';
import { normalizeMobile } from './normalize-mobile';
import { RevisitCustomerReward } from './revisit-customer-reward.entity';
import { RevisitCustomer } from './revisit-customer.entity';
import { RevisitReward } from './revisit-reward.entity';
import { RevisitVisit } from './revisit-visit.entity';
import {
  RevisitCustomerNameMode,
  RevisitLoyaltyScope,
  RevisitRewardStatus,
  RevisitVisitFrequency,
  REVISIT_SOURCE,
} from './revisit.enums';
import {
  maskMobile,
  newRewardCode,
  revisitPublicPath,
  revisitPublicUrl,
  startOfCalendarDay,
} from './revisit.util';

type ResolvedContext = {
  location: Location;
  qr: QrCode | null;
  publicCode: string;
};

@Injectable()
export class RevisitService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(QrCode) private readonly qrCodes: Repository<QrCode>,
    @InjectRepository(LocationRevisitSettings)
    private readonly settings: Repository<LocationRevisitSettings>,
    @InjectRepository(RevisitCustomer) private readonly customers: Repository<RevisitCustomer>,
    @InjectRepository(RevisitVisit) private readonly visits: Repository<RevisitVisit>,
    @InjectRepository(RevisitReward) private readonly rewards: Repository<RevisitReward>,
    @InjectRepository(RevisitCustomerReward)
    private readonly customerRewards: Repository<RevisitCustomerReward>,
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async getPublicPage(rawCode: string) {
    const ctx = await this.resolvePublic(rawCode);
    const settings = await this.ensureSettingsRow(ctx.location.id);
    await this.assertRevisitLive(ctx.location.id, settings);

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    const code = ctx.location.reviewCode ?? ctx.location.slug ?? ctx.publicCode;
    return {
      code,
      businessName: ctx.location.name,
      locationName: ctx.location.name,
      customerNameMode: settings.customerNameMode,
      otpEnabled: settings.otpEnabled,
      publicPath: revisitPublicPath(code),
      publicUrl: revisitPublicUrl(appUrl, code),
    };
  }

  async checkIn(rawCode: string, dto: RevisitCheckInDto) {
    const ctx = await this.resolvePublic(rawCode);
    const settings = await this.ensureSettingsRow(ctx.location.id);
    await this.assertRevisitLive(ctx.location.id, settings);

    const mobile = normalizeMobile(dto.mobile);
    if (!mobile.ok) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: mobile.message,
      });
    }

    const name = dto.name?.trim();
    if (settings.customerNameMode === RevisitCustomerNameMode.REQUIRED && !name) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Please add your name to continue',
      });
    }

    if (dto.idempotencyKey?.trim()) {
      const prior = await this.visits.findOne({
        where: { idempotencyKey: dto.idempotencyKey.trim() },
      });
      if (prior) {
        return this.buildCheckInResponse(prior.customerId, ctx, settings, 'idempotent_replay');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const customerRepo = manager.getRepository(RevisitCustomer);
      const visitRepo = manager.getRepository(RevisitVisit);
      const rewardRepo = manager.getRepository(RevisitReward);
      const customerRewardRepo = manager.getRepository(RevisitCustomerReward);

      let customer = await customerRepo.findOne({
        where: {
          businessId: ctx.location.businessId,
          mobileE164: mobile.e164,
        },
        lock: { mode: 'pessimistic_write' },
      });

      const isNew = !customer;
      if (!customer) {
        customer = customerRepo.create({
          businessId: ctx.location.businessId,
          mobileE164: mobile.e164,
          name: name || null,
          totalVisits: 0,
        });
        customer = await customerRepo.save(customer);
      } else if (name && !customer.name) {
        customer.name = name;
        await customerRepo.save(customer);
      }

      const visitCount = await this.countVisitsForScope(
        visitRepo,
        customer.id,
        ctx.location,
        settings.loyaltyScope,
      );

      const lastVisit = await this.lastVisitForScope(
        visitRepo,
        customer.id,
        ctx.location,
        settings.loyaltyScope,
      );

      if (lastVisit && !this.canRecordVisit(settings, lastVisit.visitedAt)) {
        return this.buildCheckInResponse(
          customer.id,
          ctx,
          settings,
          'already_checked_in',
          visitCount,
          customer,
        );
      }

      const visitNumber = visitCount + 1;
      const now = new Date();
      const visit = visitRepo.create({
        customerId: customer.id,
        businessId: ctx.location.businessId,
        locationId: ctx.location.id,
        qrId: ctx.qr?.id ?? null,
        mobileE164: mobile.e164,
        visitedAt: now,
        visitNumber,
        source: REVISIT_SOURCE,
        sessionId: dto.sessionId?.trim() || null,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
      });

      try {
        await visitRepo.save(visit);
      } catch (err) {
        if (dto.idempotencyKey?.trim()) {
          const replay = await visitRepo.findOne({
            where: { idempotencyKey: dto.idempotencyKey.trim() },
          });
          if (replay) {
            return this.buildCheckInResponse(
              replay.customerId,
              ctx,
              settings,
              'idempotent_replay',
            );
          }
        }
        throw err;
      }

      const businessWideVisits = await visitRepo.count({
        where: { customerId: customer.id, businessId: ctx.location.businessId },
      });
      customer.totalVisits = businessWideVisits;
      customer.lastVisitAt = now;
      if (!customer.firstVisitAt) customer.firstVisitAt = now;
      await customerRepo.save(customer);

      await this.unlockEligibleRewards(
        customerRewardRepo,
        rewardRepo,
        customer.id,
        ctx.location.businessId,
        visitNumber,
      );

      return this.buildCheckInResponse(
        customer.id,
        ctx,
        settings,
        isNew ? 'first_visit' : 'new_visit',
        visitNumber,
        customer,
      );
    });
  }

  async merchantSummary(user: User, locationId: string) {
    const location = await this.requireLocationMember(user, locationId);
    const settings = await this.ensureSettingsRow(locationId);
    const withCode = await this.ensurePublicCode(location);
    const menuAccess = await this.subscriptions.getProductAccess(
      locationId,
      BillingProduct.QUICK_MENU,
    );
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    const code = withCode.reviewCode!;
    const slug = withCode.slug?.trim().toLowerCase() ?? '';
    const useCommerceHub = menuAccess.unlocked && Boolean(slug);
    const stats = await this.dashboardStats(location.businessId, locationId);

    return {
      locationId: location.id,
      publicCode: code,
      publicPath: useCommerceHub ? commerceHubPublicPath(slug) : revisitPublicPath(code),
      publicUrl: useCommerceHub
        ? commerceHubPublicFullUrl(appUrl, slug)
        : revisitPublicUrl(appUrl, code),
      revisitUnlocked: menuAccess.unlocked,
      revisitAccess: menuAccess,
      settings: this.serializeSettings(settings),
      stats,
    };
  }

  async getSettings(user: User, locationId: string) {
    await this.requireLocationMember(user, locationId);
    const settings = await this.ensureSettingsRow(locationId);
    const rewards = await this.rewards.find({
      where: { businessId: (await this.locations.findOneByOrFail({ id: locationId })).businessId },
      order: { visitThreshold: 'ASC' },
    });
    return {
      settings: this.serializeSettings(settings),
      rewards: rewards.map((r) => this.serializeReward(r)),
    };
  }

  async updateSettings(user: User, locationId: string, dto: UpdateRevisitSettingsDto) {
    const location = await this.requireLocationMember(user, locationId, MANAGER_ROLES);
    const row = await this.ensureSettingsRow(locationId);
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    if (dto.visitFrequency !== undefined) row.visitFrequency = dto.visitFrequency;
    if (dto.visitFrequencyHours !== undefined) row.visitFrequencyHours = dto.visitFrequencyHours;
    if (dto.loyaltyScope !== undefined) row.loyaltyScope = dto.loyaltyScope;
    if (dto.customerNameMode !== undefined) row.customerNameMode = dto.customerNameMode;
    if (dto.otpEnabled !== undefined) row.otpEnabled = dto.otpEnabled;
    await this.settings.save(row);
    return { settings: this.serializeSettings(row) };
  }

  async updateRewards(user: User, locationId: string, dto: UpdateRevisitRewardsDto) {
    const location = await this.requireLocationMember(user, locationId, MANAGER_ROLES);
    const existing = await this.rewards.find({ where: { businessId: location.businessId } });
    const byId = new Map(existing.map((r) => [r.id, r]));
    const keepIds = new Set<string>();

    for (const input of dto.rewards) {
      if (input.id && byId.has(input.id)) {
        const row = byId.get(input.id)!;
        this.applyRewardInput(row, input);
        await this.rewards.save(row);
        keepIds.add(row.id);
      } else {
        const created = this.rewards.create({
          businessId: location.businessId,
          ...this.rewardFields(input),
        });
        const saved = await this.rewards.save(created);
        keepIds.add(saved.id);
      }
    }

    for (const row of existing) {
      if (!keepIds.has(row.id)) {
        row.active = false;
        await this.rewards.save(row);
      }
    }

    const rewards = await this.rewards.find({
      where: { businessId: location.businessId, active: true },
      order: { visitThreshold: 'ASC' },
    });
    return { rewards: rewards.map((r) => this.serializeReward(r)) };
  }

  async listCustomers(
    user: User,
    locationId: string,
    query: { search?: string; limit?: number },
  ) {
    const location = await this.requireLocationMember(user, locationId);
    const limit = Math.min(query.limit ?? 100, 200);
    const qb = this.customers
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId: location.businessId })
      .orderBy('c.lastVisitAt', 'DESC', 'NULLS LAST')
      .take(limit);

    const search = query.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      if (digits.length >= 4) {
        qb.andWhere('c.mobileE164 LIKE :mobile', { mobile: `%${digits}%` });
      } else {
        qb.andWhere('LOWER(c.name) LIKE :name', { name: `%${search.toLowerCase()}%` });
      }
    }

    const rows = await qb.getMany();
    const rewardMap = await this.currentRewardLabels(location.businessId, rows.map((r) => r.id));
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: maskMobile(c.mobileE164),
      totalVisits: c.totalVisits,
      firstVisitAt: c.firstVisitAt,
      lastVisitAt: c.lastVisitAt,
      currentReward: rewardMap.get(c.id)?.label ?? null,
      rewardStatus: rewardMap.get(c.id)?.status ?? null,
    }));
  }

  async customerDetail(user: User, locationId: string, customerId: string) {
    const location = await this.requireLocationMember(user, locationId);
    const customer = await this.customers.findOne({
      where: { id: customerId, businessId: location.businessId },
    });
    if (!customer) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Customer not found' });
    }

    const visitRows = await this.visits.find({
      where: { customerId: customer.id },
      order: { visitedAt: 'DESC' },
      take: 100,
    });

    const unlocked = await this.customerRewards.find({
      where: { customerId: customer.id },
      order: { unlockedAt: 'DESC' },
    });
    const rewardIds = unlocked.map((u) => u.rewardId);
    const rewardRows =
      rewardIds.length > 0 ? await this.rewards.find({ where: { id: In(rewardIds) } }) : [];
    const rewardById = new Map(rewardRows.map((r) => [r.id, r]));

    const progress = await this.progressForCustomer(customer, location.businessId);

    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobileE164,
      totalVisits: customer.totalVisits,
      firstVisitAt: customer.firstVisitAt,
      lastVisitAt: customer.lastVisitAt,
      progress,
      rewardsUnlocked: unlocked.map((u) => ({
        id: u.id,
        rewardCode: u.rewardCode,
        status: u.status,
        unlockedAt: u.unlockedAt,
        redeemedAt: u.redeemedAt,
        name: rewardById.get(u.rewardId)?.name ?? 'Reward',
        description: rewardById.get(u.rewardId)?.description ?? null,
      })),
      visits: visitRows.map((v) => ({
        id: v.id,
        visitedAt: v.visitedAt,
        visitNumber: v.visitNumber,
        locationId: v.locationId,
      })),
    };
  }

  async redeemReward(user: User, locationId: string, customerRewardId: string) {
    const location = await this.requireLocationMember(user, locationId, MANAGER_ROLES);
    const row = await this.customerRewards.findOne({ where: { id: customerRewardId } });
    if (!row) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Reward not found' });
    }
    const customer = await this.customers.findOne({
      where: { id: row.customerId, businessId: location.businessId },
    });
    if (!customer) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: 'Not allowed' });
    }
    if (row.status === RevisitRewardStatus.REDEEMED) {
      return { id: row.id, status: row.status, redeemedAt: row.redeemedAt };
    }
    row.status = RevisitRewardStatus.REDEEMED;
    row.redeemedAt = new Date();
    await this.customerRewards.save(row);
    return { id: row.id, status: row.status, redeemedAt: row.redeemedAt };
  }

  private async buildCheckInResponse(
    customerId: string,
    ctx: ResolvedContext,
    settings: LocationRevisitSettings,
    outcome: string,
    visitCount?: number,
    customer?: RevisitCustomer,
  ) {
    const c =
      customer ??
      (await this.customers.findOneOrFail({ where: { id: customerId } }));
    const total =
      visitCount ??
      (await this.countVisitsForScope(
        this.visits,
        customerId,
        ctx.location,
        settings.loyaltyScope,
      ));

    const progress = await this.progressForCustomer(c, ctx.location.businessId, total);
    const freshUnlock = await this.customerRewards.findOne({
      where: { customerId: c.id },
      order: { unlockedAt: 'DESC' },
    });

    let unlockedReward: {
      name: string;
      rewardCode: string;
      customerRewardId: string;
    } | null = null;
    if (freshUnlock && freshUnlock.unlockedAt.getTime() > Date.now() - 5000) {
      const reward = await this.rewards.findOne({ where: { id: freshUnlock.rewardId } });
      if (reward) {
        unlockedReward = {
          name: reward.name,
          rewardCode: freshUnlock.rewardCode,
          customerRewardId: freshUnlock.id,
        };
      }
    }

    return {
      outcome,
      businessName: ctx.location.name,
      customer: {
        name: c.name,
        mobileMasked: maskMobile(c.mobileE164),
      },
      totalVisits: total,
      progress,
      unlockedReward,
      alreadyCheckedInToday: outcome === 'already_checked_in',
    };
  }

  private async progressForCustomer(
    customer: RevisitCustomer,
    businessId: string,
    totalVisits = customer.totalVisits,
  ) {
    const activeRewards = await this.rewards.find({
      where: { businessId, active: true },
      order: { visitThreshold: 'ASC' },
    });
    const next = activeRewards.find((r) => r.visitThreshold > totalVisits) ?? null;
    const currentMilestone = activeRewards.filter((r) => r.visitThreshold <= totalVisits).pop();

    if (!next) {
      return {
        hasRewards: activeRewards.length > 0,
        currentMilestone: currentMilestone
          ? { name: currentMilestone.name, threshold: currentMilestone.visitThreshold }
          : null,
        nextReward: null,
        remaining: 0,
        progressCurrent: totalVisits,
        progressTarget: totalVisits,
      };
    }

    const base = currentMilestone?.visitThreshold ?? 0;
    const span = next.visitThreshold - base;
    const currentInSpan = totalVisits - base;

    return {
      hasRewards: true,
      currentMilestone: currentMilestone
        ? { name: currentMilestone.name, threshold: currentMilestone.visitThreshold }
        : null,
      nextReward: {
        name: next.name,
        description: next.description,
        threshold: next.visitThreshold,
        rewardValue: next.rewardValue,
      },
      remaining: next.visitThreshold - totalVisits,
      progressCurrent: totalVisits,
      progressTarget: next.visitThreshold,
      progressInSpan: currentInSpan,
      progressSpan: span,
    };
  }

  private async unlockEligibleRewards(
    customerRewardRepo: Repository<RevisitCustomerReward>,
    rewardRepo: Repository<RevisitReward>,
    customerId: string,
    businessId: string,
    visitNumber: number,
  ) {
    const eligible = await rewardRepo.find({
      where: { businessId, active: true },
    });
    for (const reward of eligible) {
      if (reward.visitThreshold !== visitNumber) continue;
      const exists = await customerRewardRepo.exist({
        where: { customerId, rewardId: reward.id },
      });
      if (exists) continue;
      await customerRewardRepo.save(
        customerRewardRepo.create({
          customerId,
          rewardId: reward.id,
          unlockedAt: new Date(),
          status: RevisitRewardStatus.UNLOCKED,
          rewardCode: newRewardCode(),
        }),
      );
    }
  }

  private canRecordVisit(settings: LocationRevisitSettings, lastVisitedAt: Date): boolean {
    if (settings.visitFrequency === RevisitVisitFrequency.UNLIMITED) return true;
    const now = Date.now();
    if (settings.visitFrequency === RevisitVisitFrequency.ONCE_PER_DAY) {
      return startOfCalendarDay(lastVisitedAt).getTime() < startOfCalendarDay(new Date()).getTime();
    }
    const hours = Math.max(1, settings.visitFrequencyHours || 24);
    return now - lastVisitedAt.getTime() >= hours * 3_600_000;
  }

  private async countVisitsForScope(
    visitRepo: Repository<RevisitVisit>,
    customerId: string,
    location: Location,
    scope: RevisitLoyaltyScope,
  ): Promise<number> {
    if (scope === RevisitLoyaltyScope.PER_LOCATION) {
      return visitRepo.count({ where: { customerId, locationId: location.id } });
    }
    return visitRepo.count({ where: { customerId, businessId: location.businessId } });
  }

  private async lastVisitForScope(
    visitRepo: Repository<RevisitVisit>,
    customerId: string,
    location: Location,
    scope: RevisitLoyaltyScope,
  ): Promise<RevisitVisit | null> {
    const where =
      scope === RevisitLoyaltyScope.PER_LOCATION
        ? { customerId, locationId: location.id }
        : { customerId, businessId: location.businessId };
    return visitRepo.findOne({ where, order: { visitedAt: 'DESC' } });
  }

  private async resolvePublic(rawCode: string): Promise<ResolvedContext> {
    const trimmed = rawCode.trim();
    if (!trimmed) throw this.notFound('Quick Revisit link not found');

    const qr = await this.qrCodes.findOne({
      where: { code: trimmed.toUpperCase() },
      relations: { location: { business: true } },
    });
    if (qr?.location && qr.location.status === LocationStatus.ACTIVE) {
      return { location: qr.location, qr, publicCode: qr.code };
    }

    const byReview = await this.locations.findOne({
      where: { reviewCode: trimmed.toUpperCase() },
      relations: { business: true },
    });
    if (byReview && byReview.status === LocationStatus.ACTIVE) {
      return { location: byReview, qr: qr?.locationId === byReview.id ? qr : null, publicCode: trimmed };
    }

    const bySlug = await this.locations.findOne({
      where: { slug: trimmed.toLowerCase() },
      relations: { business: true },
    });
    if (bySlug && bySlug.status === LocationStatus.ACTIVE) {
      return { location: bySlug, qr: null, publicCode: trimmed };
    }

    throw this.notFound('Quick Revisit link not found');
  }

  private async assertRevisitLive(locationId: string, settings: LocationRevisitSettings) {
    if (!settings.enabled) {
      throw new HttpException(
        {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Quick Revisit is not enabled for this business',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    const live = await this.subscriptions.hasActiveProduct(locationId, BillingProduct.QUICK_MENU);
    if (!live) {
      throw new HttpException(
        {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message:
            'Quick Revisit is locked until QuickCommerce is activated for this shop.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private async ensurePublicCode(location: Location): Promise<Location> {
    if (location.reviewCode) return location;
    location.reviewCode = await this.uniqueReviewCode();
    return this.locations.save(location);
  }

  private async uniqueReviewCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = newReviewCode();
      const exists = await this.locations.exist({ where: { reviewCode: code } });
      if (!exists) return code;
    }
    return newReviewCode(10);
  }

  private async ensureSettingsRow(locationId: string): Promise<LocationRevisitSettings> {
    let row = await this.settings.findOne({ where: { locationId } });
    if (row) return row;
    row = this.settings.create({ locationId });
    return this.settings.save(row);
  }

  private async requireLocationMember(user: User, locationId: string, roles?: MemberRole[]) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    await this.members.assertMember(user, location.businessId, roles);
    return location;
  }

  private async dashboardStats(businessId: string, locationId: string) {
    const now = new Date();
    const dayStart = startOfCalendarDay(now);
    const weekStart = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 3_600_000);

    const [totalCustomers, totalVisits, visitsToday, visitsWeek, visitsMonth] = await Promise.all([
      this.customers.count({ where: { businessId } }),
      this.visits.count({ where: { businessId } }),
      this.visits.count({ where: { businessId, visitedAt: MoreThanOrEqual(dayStart) } }),
      this.visits.count({ where: { businessId, visitedAt: MoreThanOrEqual(weekStart) } }),
      this.visits.count({ where: { businessId, visitedAt: MoreThanOrEqual(monthStart) } }),
    ]);

    const returning = await this.customers
      .createQueryBuilder('c')
      .where('c.businessId = :businessId', { businessId })
      .andWhere('c.totalVisits > 1')
      .getCount();

    const newCustomers = await this.customers.count({
      where: { businessId, firstVisitAt: MoreThanOrEqual(dayStart) },
    });

    return {
      totalCustomers,
      totalVisits,
      returningCustomers: returning,
      newCustomers,
      visitsToday,
      visitsThisWeek: visitsWeek,
      visitsThisMonth: visitsMonth,
    };
  }

  private async currentRewardLabels(businessId: string, customerIds: string[]) {
    const map = new Map<string, { label: string; status: string }>();
    if (!customerIds.length) return map;
    const rows = await this.customerRewards
      .createQueryBuilder('cr')
      .innerJoin(RevisitReward, 'r', 'r.id = cr.rewardId')
      .where('cr.customerId IN (:...ids)', { ids: customerIds })
      .andWhere('r.businessId = :businessId', { businessId })
      .orderBy('cr.unlockedAt', 'DESC')
      .getMany();
    for (const row of rows) {
      if (map.has(row.customerId)) continue;
      const reward = await this.rewards.findOne({ where: { id: row.rewardId } });
      map.set(row.customerId, {
        label: reward?.name ?? 'Reward',
        status: row.status,
      });
    }
    return map;
  }

  private serializeSettings(row: LocationRevisitSettings) {
    return {
      enabled: row.enabled,
      visitFrequency: row.visitFrequency,
      visitFrequencyHours: row.visitFrequencyHours,
      loyaltyScope: row.loyaltyScope,
      customerNameMode: row.customerNameMode,
      otpEnabled: row.otpEnabled,
    };
  }

  private serializeReward(row: RevisitReward) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      visitThreshold: row.visitThreshold,
      rewardType: row.rewardType,
      rewardValue: row.rewardValue,
      active: row.active,
    };
  }

  private rewardFields(input: RevisitRewardInputDto) {
    return {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      visitThreshold: input.visitThreshold,
      rewardType: input.rewardType?.trim() || 'discount',
      rewardValue: input.rewardValue?.trim() || null,
      active: input.active ?? true,
    };
  }

  private applyRewardInput(row: RevisitReward, input: RevisitRewardInputDto) {
    Object.assign(row, this.rewardFields(input));
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
