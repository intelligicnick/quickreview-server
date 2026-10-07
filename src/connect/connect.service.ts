import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { User } from '../users/user.entity';
import { ConnectLead } from './connect-lead.entity';
import { ConnectLink } from './connect-link.entity';
import { ConnectProfile } from './connect-profile.entity';
import { connectPublicUrl, slugifyConnect } from './connect.util';
import {
  CreateConnectLeadDto,
  CreateConnectLinkDto,
  UpdateConnectLinkDto,
  UpdateConnectProfileDto,
} from './dto/connect.dto';

@Injectable()
export class ConnectService {
  constructor(
    private readonly config: ConfigService,
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
    @InjectRepository(ConnectProfile) private readonly profiles: Repository<ConnectProfile>,
    @InjectRepository(ConnectLink) private readonly links: Repository<ConnectLink>,
    @InjectRepository(ConnectLead) private readonly leads: Repository<ConnectLead>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
  ) {}

  async merchantHub(user: User, locationId: string) {
    const profile = await this.ensureProfile(user, locationId);
    const [connectAccess, leadCount] = await Promise.all([
      this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_CONNECT),
      this.leads.count({ where: { connectProfileId: profile.id } }),
    ]);
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    const publicPath = `/c/${profile.slug}`;
    return {
      locationId,
      slug: profile.slug,
      publicPath,
      publicUrl: connectPublicUrl(appUrl, profile.slug),
      connectUnlocked: connectAccess.unlocked,
      connectAccess,
      leadCount,
      profile: this.serializeProfile(profile),
      links: [...(profile.links ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((link) => this.serializeLink(link)),
    };
  }

  async updateProfile(user: User, locationId: string, dto: UpdateConnectProfileDto) {
    await this.assertManager(user, locationId);
    const profile = await this.ensureProfile(user, locationId);

    if (dto.displayName !== undefined) profile.displayName = dto.displayName.trim();
    if (dto.designation !== undefined) profile.designation = dto.designation.trim() || null;
    if (dto.companyName !== undefined) profile.companyName = dto.companyName.trim() || null;
    if (dto.bio !== undefined) profile.bio = dto.bio.trim() || null;
    if (dto.phone !== undefined) profile.phone = dto.phone.trim() || null;
    if (dto.whatsappPhone !== undefined) profile.whatsappPhone = dto.whatsappPhone.trim() || null;
    if (dto.email !== undefined) profile.email = dto.email.toLowerCase().trim() || null;
    if (dto.coverImageUrl !== undefined) profile.coverImageUrl = dto.coverImageUrl.trim() || null;
    if (dto.profileImageUrl !== undefined) profile.profileImageUrl = dto.profileImageUrl.trim() || null;
    if (dto.slug !== undefined) {
      profile.slug = await this.uniqueSlug(dto.slug.trim(), profile.id);
    }

    await this.profiles.save(profile);
    return this.merchantHub(user, locationId);
  }

  async addLink(user: User, locationId: string, dto: CreateConnectLinkDto) {
    await this.assertManager(user, locationId);
    const profile = await this.ensureProfile(user, locationId);
    const maxRow = await this.links.findOne({
      where: { connectProfileId: profile.id },
      order: { sortOrder: 'DESC' },
    });
    const maxOrder = maxRow?.sortOrder ?? 0;
    const link = await this.links.save(
      this.links.create({
        connectProfileId: profile.id,
        type: dto.type,
        label: dto.label.trim(),
        url: dto.url.trim(),
        sortOrder: dto.sortOrder ?? maxOrder + 1,
      }),
    );
    return this.serializeLink(link);
  }

  async updateLink(user: User, locationId: string, linkId: string, dto: UpdateConnectLinkDto) {
    await this.assertManager(user, locationId);
    const profile = await this.ensureProfile(user, locationId);
    const link = await this.links.findOne({ where: { id: linkId, connectProfileId: profile.id } });
    if (!link) throw this.notFound('Link not found');
    if (dto.type !== undefined) link.type = dto.type;
    if (dto.label !== undefined) link.label = dto.label.trim();
    if (dto.url !== undefined) link.url = dto.url.trim();
    if (dto.sortOrder !== undefined) link.sortOrder = dto.sortOrder;
    await this.links.save(link);
    return this.serializeLink(link);
  }

  async deleteLink(user: User, locationId: string, linkId: string) {
    await this.assertManager(user, locationId);
    const profile = await this.ensureProfile(user, locationId);
    const result = await this.links.delete({ id: linkId, connectProfileId: profile.id });
    if (!result.affected) throw this.notFound('Link not found');
    return { deleted: true };
  }

  async listLeads(user: User, locationId: string, limit = 50) {
    const profile = await this.ensureProfile(user, locationId);
    const rows = await this.leads.find({
      where: { connectProfileId: profile.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      note: row.note,
      createdAt: row.createdAt,
    }));
  }

  async getPublicCard(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const profile = await this.profiles.findOne({
      where: { slug: normalized },
      relations: { location: true, links: true },
    });
    if (!profile) throw this.notFound('Card not found');
    await this.assertConnectLive(profile.locationId);

    const links = [...(profile.links ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      slug: profile.slug,
      displayName: profile.displayName,
      designation: profile.designation,
      companyName: profile.companyName,
      bio: profile.bio,
      phone: profile.phone,
      whatsappPhone: profile.whatsappPhone,
      email: profile.email,
      coverImageUrl: profile.coverImageUrl,
      profileImageUrl: profile.profileImageUrl,
      links: links.map((link) => ({
        id: link.id,
        type: link.type,
        label: link.label,
        url: link.url,
      })),
    };
  }

  async submitLead(slug: string, dto: CreateConnectLeadDto) {
    const normalized = slug.trim().toLowerCase();
    const profile = await this.profiles.findOne({ where: { slug: normalized } });
    if (!profile) throw this.notFound('Card not found');
    await this.assertConnectLive(profile.locationId);

    const lead = await this.leads.save(
      this.leads.create({
        connectProfileId: profile.id,
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.toLowerCase().trim() || null,
        note: dto.note?.trim() || null,
      }),
    );
    return { id: lead.id, createdAt: lead.createdAt };
  }

  private async ensureProfile(user: User, locationId: string): Promise<ConnectProfile> {
    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId);

    let profile = await this.profiles.findOne({
      where: { locationId },
      relations: { links: true, location: { business: true } },
    });
    if (profile) return profile;

    const baseSlug = location.slug ?? slugifyConnect(location.name);
    profile = this.profiles.create({
      locationId: location.id,
      slug: await this.uniqueSlug(baseSlug),
      displayName: location.name,
      companyName: location.business?.name ?? null,
      phone: location.phone,
      email: location.email,
      designation: null,
      bio: null,
      whatsappPhone: location.phone,
    });
    profile = await this.profiles.save(profile);
    profile.location = location;
    profile.links = [];
    return profile;
  }

  private async assertManager(user: User, locationId: string): Promise<void> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);
  }

  private async uniqueSlug(desired: string, exceptProfileId?: string): Promise<string> {
    const base = slugifyConnect(desired) || 'card';
    for (let i = 0; i < 8; i++) {
      const candidate = (i === 0 ? base : `${base}-${i + 1}`).toLowerCase();
      const existing = await this.profiles.findOne({ where: { slug: candidate } });
      if (!existing || existing.id === exceptProfileId) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async assertConnectLive(locationId: string): Promise<void> {
    const live = await this.subscriptions.hasActiveProduct(
      locationId,
      BillingProduct.QUICK_CONNECT,
    );
    if (!live) {
      throw new HttpException(
        {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message: 'This digital card is not published yet. The business needs QuickConnect active.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private serializeProfile(profile: ConnectProfile) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      designation: profile.designation,
      companyName: profile.companyName,
      bio: profile.bio,
      phone: profile.phone,
      whatsappPhone: profile.whatsappPhone,
      email: profile.email,
      coverImageUrl: profile.coverImageUrl,
      profileImageUrl: profile.profileImageUrl,
      slug: profile.slug,
    };
  }

  private serializeLink(link: ConnectLink) {
    return {
      id: link.id,
      type: link.type,
      label: link.label,
      url: link.url,
      sortOrder: link.sortOrder,
    };
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
