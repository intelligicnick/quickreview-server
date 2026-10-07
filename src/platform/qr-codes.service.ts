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
import { commerceHubPublicUrl, qrClaimUrl, revisitPublicUrl, reviewPublicUrl } from './qr-target.util';

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

  async assignQrToLocation(qr: QrCode, location: Location, kind: QrAssignKind): Promise<QrCode> {
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

  resetToClaimable(qr: QrCode): Promise<QrCode> {
    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    qr.locationId = null;
    qr.isMenuQr = null;
    qr.targetUrl = qrClaimUrl(app, qr.code);
    qr.assignedAt = null;
    return this.qrCodes.save(qr);
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
