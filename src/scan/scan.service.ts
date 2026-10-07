import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { User } from '../users/user.entity';
import { parseVisitingCardText } from './parse-card-text';
import { ScanOcrService } from './scan-ocr.service';
import { ScannedContact, type ScanCaptureMode } from './scanned-contact.entity';
import { buildVcard, clampOtherField, clampParsedCard, type ParsedCard } from './scan.util';
import type { UpdateScannedContactDto } from './dto/update-scanned-contact.dto';
import type { UploadedImageFile } from './uploaded-file.type';

@Injectable()
export class ScanService {
  constructor(
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly ocr: ScanOcrService,
    @InjectRepository(ScannedContact) private readonly contacts: Repository<ScannedContact>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  async merchantHub(user: User, locationId: string) {
    const location = await this.assertManager(user, locationId);
    const [rows, access] = await Promise.all([
      this.contacts.find({
        where: { locationId },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_SCAN),
    ]);
    return {
      locationId,
      locationName: location.name,
      scanUnlocked: access.unlocked,
      scanAccess: access,
      contacts: rows.map((row) => this.serializeContact(row)),
    };
  }

  async scanCard(
    user: User,
    locationId: string,
    mode: ScanCaptureMode,
    front?: UploadedImageFile,
    back?: UploadedImageFile,
  ) {
    await this.assertManager(user, locationId);
    const access = await this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_SCAN);
    if (!access.unlocked) {
      throw new ForbiddenException('Activate QuickScan on Subscription to scan visiting cards');
    }

    if (mode === 'front' && !front) {
      throw new BadRequestException('Upload the front of the visiting card');
    }
    if (mode === 'back' && !back) {
      throw new BadRequestException('Upload the back of the visiting card');
    }
    if (mode === 'both' && (!front || !back)) {
      throw new BadRequestException('Upload both front and back images');
    }

    const parsed = clampParsedCard(await this.extractContact(front, back));
    const saved = await this.contacts.save(
      this.contacts.create({
        locationId,
        captureMode: mode,
        fullName: parsed.fullName,
        companyName: null,
        designation: null,
        phones: parsed.phones,
        emails: parsed.emails,
        websites: parsed.websites,
        address: parsed.address,
        services: parsed.services,
        products: parsed.products,
        notes: parsed.other,
        frontImage: front?.buffer ?? null,
        frontMimeType: front?.mimetype ?? null,
        backImage: back?.buffer ?? null,
        backMimeType: back?.mimetype ?? null,
      }),
    );

    return {
      contact: this.serializeContact(saved),
      vcard: buildVcard(saved),
    };
  }

  async getVcard(user: User, locationId: string, contactId: string) {
    await this.assertManager(user, locationId);
    const contact = await this.contacts.findOne({ where: { id: contactId, locationId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return { vcard: buildVcard(contact), filename: this.vcardFilename(contact) };
  }

  async deleteContact(user: User, locationId: string, contactId: string) {
    await this.assertManager(user, locationId);
    const contact = await this.contacts.findOne({ where: { id: contactId, locationId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    await this.contacts.delete({ id: contact.id });
  }

  async updateContact(
    user: User,
    locationId: string,
    contactId: string,
    dto: UpdateScannedContactDto,
  ) {
    await this.assertManager(user, locationId);
    const contact = await this.contacts.findOne({ where: { id: contactId, locationId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (dto.fullName !== undefined) {
      contact.fullName = dto.fullName.trim() || null;
    }
    if (dto.phones !== undefined) {
      contact.phones = dto.phones.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    if (dto.emails !== undefined) {
      contact.emails = dto.emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    }
    if (dto.websites !== undefined) {
      contact.websites = dto.websites.map((w) => w.trim()).filter(Boolean);
    }
    if (dto.address !== undefined) {
      contact.address = dto.address.replace(/\s+/g, ' ').trim() || null;
    }
    if (dto.services !== undefined) {
      contact.services = dto.services.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    if (dto.products !== undefined) {
      contact.products = dto.products.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    }
    if (dto.other !== undefined) {
      contact.notes = clampOtherField(dto.other);
    }

    const saved = await this.contacts.save(contact);
    return { contact: this.serializeContact(saved) };
  }

  private async extractContact(
    front?: UploadedImageFile,
    back?: UploadedImageFile,
  ): Promise<ParsedCard> {
    const images: UploadedImageFile[] = [];
    if (front) images.push(front);
    if (back) images.push(back);

    let rawText: string;
    try {
      rawText = await this.ocr.recognizeFiles(images);
    } catch (err) {
      throw new BadGatewayException(
        `OCR failed: ${err instanceof Error ? err.message : 'could not read image'}`,
      );
    }

    if (!rawText.trim()) {
      throw new BadGatewayException('No text found on the card — use a clearer, well-lit photo.');
    }

    return parseVisitingCardText(rawText);
  }

  private serializeContact(row: ScannedContact) {
    return {
      id: row.id,
      fullName: row.fullName,
      phones: row.phones ?? [],
      emails: row.emails ?? [],
      websites: row.websites ?? [],
      address: row.address,
      services: row.services ?? [],
      products: row.products ?? [],
      other: row.notes,
      createdAt: row.createdAt,
    };
  }

  private vcardFilename(contact: ScannedContact): string {
    const base = (contact.fullName || 'contact')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base || 'contact'}.vcf`;
  }

  private async assertManager(user: User, locationId: string): Promise<Location> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);
    return location;
  }
}
