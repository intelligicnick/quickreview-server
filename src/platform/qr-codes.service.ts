import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { newReviewCode } from '../common/utils/review-code';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { User } from '../users/user.entity';
import { QrCode } from './entities/qr-code.entity';
import { BillingProduct } from './enums/billing-product.enum';
import { commerceHubPublicUrl, qrClaimUrl, revisitPublicUrl, reviewPublicUrl } from './qr-target.util';

export const MERCHANT_DIGITAL_BATCH_ID = 'merchant-digital';

export type QrAssignKind = 'review' | 'menu' | 'revisit';

@Injectable()
export class QrCodesService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(QrCode) private readonly qrCodes: Repository<QrCode>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly members: MembersService,
  ) {}

  async resolvePublic(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) throw this.notFound('QR code not found');
    const qr = await this.qrCodes.findOne({ where: { code } });
    if (!qr) throw this.notFound('QR code not found');
    return {
      code: qr.code,
      targetUrl: qr.targetUrl?.trim() || null,
      assigned: Boolean(qr.locationId),
    };
  }

  async listForLocation(user: User, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);

    const rows = await this.qrCodes.find({
      where: { locationId },
      order: { createdAt: 'DESC' },
    });
    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      batchId: row.batchId,
      claimUrl: qrClaimUrl(app, row.code),
      targetUrl: row.targetUrl,
      isMenuQr: row.isMenuQr,
      isPrinted: row.isPrinted,
      isMerchantDigital: row.batchId === MERCHANT_DIGITAL_BATCH_ID,
      assignedAt: row.assignedAt,
    }));
  }

  /** One review `/q/` code per location when QuickReview is activated (self-serve trial, payment, or admin comp). */
  async ensureMerchantDigitalQr(locationId: string, product: BillingProduct): Promise<void> {
    if (product !== BillingProduct.QUICK_REVIEW) return;

    const existing = await this.qrCodes.findOne({
      where: { locationId, batchId: MERCHANT_DIGITAL_BATCH_ID },
    });
    if (existing) return;

    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) return;

    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    let code = newReviewCode(8);
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await this.qrCodes.exist({ where: { code } });
      if (!exists) break;
      code = newReviewCode(8);
    }
    const qr = await this.qrCodes.save(
      this.qrCodes.create({
        code,
        batchId: MERCHANT_DIGITAL_BATCH_ID,
        targetUrl: qrClaimUrl(app, code),
        isPrinted: false,
      }),
    );
    await this.assignQrToLocation(qr, location, 'review', { digital: true });
  }

  async claimForLocation(user: User, locationId: string, rawCode: string, kind: QrAssignKind) {
    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);

    const code = rawCode.trim().toUpperCase();
    const qr = await this.qrCodes.findOne({ where: { code } });
    if (!qr) throw this.notFound('QR code not found');
    if (qr.locationId && qr.locationId !== locationId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This QR code is already linked to another location',
      });
    }

    await this.assignQrToLocation(qr, location, kind);
    return {
      code: qr.code,
      targetUrl: qr.targetUrl,
      kind,
      locationId: location.id,
    };
  }

  async assignQrToLocation(
    qr: QrCode,
    location: Location,
    kind: QrAssignKind,
    opts?: { digital?: boolean },
  ): Promise<QrCode> {
    if (qr.locationId && qr.locationId !== location.id) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This QR code is already linked to another location',
      });
    }
    if (!opts?.digital) {
      this.assertAssignableStock(qr, location.id);
      await this.assertLocationCanReceivePrintedStandee(
        location.id,
        qr.locationId === location.id ? qr.id : undefined,
      );
    }

    if (!location.reviewCode) {
      location.reviewCode = newReviewCode(8);
      await this.locations.save(location);
    }
    const slug = location.slug ?? location.reviewCode;
    if (!location.slug) {
      location.slug = slug;
      await this.locations.save(location);
    }
    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    const isMenu = kind === 'menu';
    const isRevisit = kind === 'revisit';
    qr.locationId = location.id;
    qr.isMenuQr = isRevisit ? null : isMenu;
    qr.targetUrl = isRevisit
      ? revisitPublicUrl(app, location.reviewCode!)
      : isMenu
        ? commerceHubPublicUrl(app, slug!)
        : reviewPublicUrl(app, location.reviewCode!);
    qr.assignedAt = new Date();
    return this.qrCodes.save(qr);
  }

  assertNotLockedStandee(qr: QrCode): void {
    if (qr.isPrinted && qr.locationId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Printed standee codes cannot be unassigned',
      });
    }
  }

  resetToClaimable(qr: QrCode): Promise<QrCode> {
    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    qr.locationId = null;
    qr.isMenuQr = null;
    qr.targetUrl = qrClaimUrl(app, qr.code);
    qr.assignedAt = null;
    return this.qrCodes.save(qr);
  }

  assertAssignableStock(qr: QrCode, locationId: string): void {
    if (qr.locationId === locationId) return;
    if (!qr.isPrinted) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Only printed, unassigned QR codes can be assigned',
      });
    }
    if (qr.locationId) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This QR code is already linked to another location',
      });
    }
  }

  private async assertLocationCanReceivePrintedStandee(
    locationId: string,
    excludingQrId?: string,
  ): Promise<void> {
    const qb = this.qrCodes
      .createQueryBuilder('qr')
      .where('qr.locationId = :locationId', { locationId })
      .andWhere('qr.isPrinted = true');
    if (excludingQrId) {
      qb.andWhere('qr.id != :excludingQrId', { excludingQrId });
    }
    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This location already has a printed standee assigned',
      });
    }
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
