import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { googleWriteReviewUrl, normalizeQrStockCode } from '../common/utils/review-code';
import { BusinessesService } from '../businesses/businesses.service';
import { Business } from '../businesses/business.entity';
import { Location } from '../locations/location.entity';
import { QrCode } from '../platform/entities/qr-code.entity';
import { Plan } from '../platform/entities/plan.entity';
import { QrCodesService } from '../platform/qr-codes.service';
import { AdminPlatformService } from '../admin/admin-platform.service';
import { GoogleLocationFromPlaceService } from '../google/google-location-from-place.service';
import { GooglePlacesService } from '../google/google-places.service';
import { categoryLabelFromTypes } from '../google/menu-mode.util';
import { User } from '../users/user.entity';
import { CounterSaleProvision } from './counter-sale-provision.entity';
import { CounterSaleServiceKind } from './counter-sale-service.enum';
import { CounterSaleHoldingService } from './counter-sale-holding.service';
import { CounterSaleProvisionerContext } from './guards/counter-sale-provisioner.guard';
import { CounterSaleProvisionDto } from './dto/counter-sale.dto';

@Injectable()
export class CounterSaleProvisionService {
  constructor(
    @InjectRepository(QrCode) private readonly qrCodes: Repository<QrCode>,
    @InjectRepository(CounterSaleProvision) private readonly provisions: Repository<CounterSaleProvision>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly places: GooglePlacesService,
    private readonly locationFromPlace: GoogleLocationFromPlaceService,
    private readonly businessesService: BusinessesService,
    private readonly qrCodesService: QrCodesService,
    private readonly holding: CounterSaleHoldingService,
    private readonly adminPlatform: AdminPlatformService,
    private readonly config: ConfigService,
  ) {}

  private dailyProvisionCap(): number {
    const raw = this.config.get<string>('COUNTER_SALE_DAILY_PROVISION_CAP');
    const n = raw ? Number.parseInt(raw, 10) : 25;
    return Number.isFinite(n) && n > 0 ? n : 25;
  }

  private async assertAgentDailyProvisionCap(agentId: string): Promise<void> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const count = await this.provisions
      .createQueryBuilder('p')
      .where('p.provisionedByAgentId = :agentId', { agentId })
      .andWhere('p.createdAt >= :start', { start })
      .getCount();
    const cap = this.dailyProvisionCap();
    if (count >= cap) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Daily provision limit (${cap}) reached for this agent`,
      });
    }
  }

  async lookupQr(raw: string) {
    const code = normalizeQrStockCode(raw);
    const existingProvision = await this.provisions.findOne({ where: { qrCode: code } });
    if (existingProvision) {
      return { code, status: 'assigned' as const };
    }
    const qr = await this.qrCodes.findOne({ where: { code } });
    if (!qr) {
      return { code, status: 'not_found' as const };
    }
    if (qr.locationId) {
      return { code, status: 'assigned' as const };
    }
    return { code, status: 'ready' as const };
  }

  async provision(actor: CounterSaleProvisionerContext, dto: CounterSaleProvisionDto) {
    const code = normalizeQrStockCode(dto.qrCode);
    const placeId = dto.placeId.trim();

    if (actor.kind === 'agent') {
      await this.assertAgentDailyProvisionCap(actor.agent.id);
    }

    const existingProvision = await this.provisions.findOne({ where: { qrCode: code } });
    if (existingProvision) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This QR code was already used for counter sale',
      });
    }

    const qr = await this.qrCodes.findOne({ where: { code } });
    if (!qr) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'QR code not found',
      });
    }
    if (qr.locationId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This QR code is already linked to a location',
      });
    }
    if (!qr.isPrinted) {
      qr.isPrinted = true;
      await this.qrCodes.save(qr);
    }
    this.qrCodesService.assertAssignableStock(qr, '');

    const snapshot = await this.places.fetchPlaceDetails(placeId);
    await this.locationFromPlace.assertPlaceAvailable(placeId);

    const holdingUser = await this.holding.getHoldingUser();
    const business = await this.createBusiness(holdingUser, snapshot);
    const location = await this.locationFromPlace.createLocationFromPlace(
      holdingUser,
      business.id,
      snapshot,
      null,
    );

    const kind = dto.service === CounterSaleServiceKind.MENU ? 'menu' : 'review';
    const assignedQr = await this.qrCodesService.assignQrToLocation(qr, location, kind);

    const planCode =
      dto.service === CounterSaleServiceKind.MENU ? 'quickmenu_trial' : 'quickreview_trial';
    const plan = await this.plans.findOne({ where: { code: planCode, isActive: true } });
    if (!plan) {
      throw new BadRequestException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `Trial plan ${planCode} is not configured`,
      });
    }
    await this.adminPlatform.grantComp(holdingUser, {
      locationId: location.id,
      planId: plan.id,
      reason: 'Counter sale setup',
    });

    const row = await this.provisions.save(
      this.provisions.create({
        businessId: business.id,
        locationId: location.id,
        qrCode: code,
        service: dto.service,
        provisionedByAgentId: actor.kind === 'agent' ? actor.agent.id : null,
        provisionedByUserId: actor.kind === 'admin' ? actor.user.id : null,
      }),
    );

    const freshLocation = await this.locations.findOne({ where: { id: location.id } });
    const googleReviewUrl =
      freshLocation?.googleReviewUrl ?? googleWriteReviewUrl(placeId);
    const targetUrl = assignedQr.targetUrl?.trim() || null;

    const summary = {
      qrCode: code,
      businessName: business.name,
      service: dto.service,
      googleReviewUrl,
      targetUrl,
    };

    return {
      provisionId: row.id,
      qrCode: code,
      service: dto.service,
      business: { id: business.id, name: business.name },
      location: {
        id: location.id,
        name: location.name,
        googleReviewUrl,
        googlePlaceId: placeId,
      },
      targetUrl,
      summary,
      createdAt: row.createdAt,
    };
  }

  private async createBusiness(holdingUser: User, snapshot: Awaited<ReturnType<GooglePlacesService['fetchPlaceDetails']>>): Promise<Business> {
    return this.businessesService.create(holdingUser, {
      name: snapshot.name,
      category: categoryLabelFromTypes(snapshot.primaryType, snapshot.primaryTypeDisplay) ?? undefined,
      phone: snapshot.phone ?? undefined,
      address: snapshot.formattedAddress ?? undefined,
      googleReviewUrl: googleWriteReviewUrl(snapshot.placeId),
      website: snapshot.website ?? undefined,
    });
  }
}
