import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { AuthService } from '../auth/auth.service';
import { Business } from '../businesses/business.entity';
import { Location } from '../locations/location.entity';
import { LocationStatus } from '../locations/location-status.enum';
import { BusinessMember } from '../members/business-member.entity';
import { MemberRole } from '../members/member-role.enum';
import { MemberStatus } from '../members/member-status.enum';
import { toPublicUser } from '../users/user.serializer';
import { User } from '../users/user.entity';
import { AdminEvent } from './admin-event.entity';
import { UpdateAdminLocationDto, UpdateAdminUserDto } from './dto/admin.dto';
import { AdminPlatformService } from './admin-platform.service';

function searchTerm(raw?: string): string | null {
  const cleaned = (raw ?? '').trim().slice(0, 80).replace(/[%_\\]/g, '');
  if (!cleaned) return null;
  return `%${cleaned}%`;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
    @InjectRepository(AdminEvent)
    private readonly events: Repository<AdminEvent>,
    private readonly authService: AuthService,
    private readonly platform: AdminPlatformService,
  ) {}

  async overview() {
    const [users, unverified, disabled, businesses, locations, recentActions] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { emailVerifiedAt: IsNull() } }),
      this.users.count({ where: { isActive: false } }),
      this.businesses.count(),
      this.locations.count(),
      this.events.find({ order: { createdAt: 'DESC' }, take: 8 }),
    ]);

    const businessesWithoutLocations = await this.businesses
      .createQueryBuilder('business')
      .leftJoin('business.locations', 'location')
      .where('location.id IS NULL')
      .getCount();

    const unverifiedUsers = await this.users.find({
      where: { emailVerifiedAt: IsNull(), isActive: true, isSuperAdmin: false },
      order: { createdAt: 'DESC' },
      take: 6,
    });

    const recentSignups = await this.users.find({
      where: { isSuperAdmin: false },
      order: { createdAt: 'DESC' },
      take: 6,
    });

    const emptyBusinesses = await this.businesses
      .createQueryBuilder('business')
      .leftJoin('business.locations', 'location')
      .where('location.id IS NULL')
      .orderBy('business.createdAt', 'DESC')
      .take(6)
      .getMany();

    const owners = await this.ownersFor(emptyBusinesses.map((business) => business.ownerUserId));

    return {
      counts: {
        users,
        unverified,
        disabled,
        businesses,
        locations,
        businessesWithoutLocations,
      },
      unverifiedUsers: unverifiedUsers.map((user) => toPublicUser(user)),
      recentSignups: recentSignups.map((user) => toPublicUser(user)),
      businessesWithoutLocations: emptyBusinesses.map((business) => ({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        owner: owners.get(business.ownerUserId) ?? null,
      })),
      recentActions: recentActions.map((event) => ({
        id: event.id,
        action: event.action,
        summary: event.summary,
        createdAt: event.createdAt,
      })),
    };
  }

  async listUsers(q?: string, status?: 'unverified' | 'disabled' | 'active') {
    const qb = this.users.createQueryBuilder('user').orderBy('user.createdAt', 'DESC').take(100);
    const term = searchTerm(q);
    if (term) {
      qb.andWhere(
        '(LOWER(user.email) LIKE LOWER(:term) OR LOWER(user.name) LIKE LOWER(:term))',
        { term },
      );
    }
    if (status === 'unverified') qb.andWhere('user.emailVerifiedAt IS NULL');
    if (status === 'disabled') qb.andWhere('user.isActive = false');
    if (status === 'active') qb.andWhere('user.isActive = true');

    const rows = await qb.getMany();
    const counts = await this.businessCounts(rows.map((user) => user.id));
    return rows.map((user) => ({
      ...toPublicUser(user),
      businessCount: counts.get(user.id) ?? 0,
    }));
  }

  async getUser(userId: string) {
    const user = await this.findUser(userId);
    const businesses = await this.businesses.find({
      where: { ownerUserId: userId },
      relations: { locations: true },
      order: { createdAt: 'DESC' },
    });
    const billing = await this.platform.merchantBillingForUser(userId);
    const events = await this.events
      .createQueryBuilder('event')
      .where('LOWER(event.summary) LIKE LOWER(:needle)', { needle: `%${user.email}%` })
      .orderBy('event.createdAt', 'DESC')
      .take(15)
      .getMany();
    return {
      ...toPublicUser(user),
      businesses: businesses.map((business) => ({
        id: business.id,
        name: business.name,
        category: business.category,
        isActive: business.isActive,
        createdAt: business.createdAt,
        locations: (business.locations ?? []).map((location) => ({
          id: location.id,
          name: location.name,
          status: location.status,
          address: location.address,
          slug: location.slug,
          reviewCode: location.reviewCode,
          menuMode: location.menuMode,
        })),
      })),
      billing,
      history: events.map((event) => ({
        id: event.id,
        summary: event.summary,
        createdAt: event.createdAt,
      })),
    };
  }

  async listActivity(take = 50) {
    return this.platform.listActivityEvents(take);
  }

  async updateUser(actor: User, userId: string, dto: UpdateAdminUserDto) {
    const user = await this.findUser(userId);
    if (dto.isActive === false && user.id === actor.id) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'You cannot disable your own super admin account',
      });
    }

    const changes: string[] = [];
    if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
      user.isActive = dto.isActive;
      changes.push(dto.isActive ? 'enabled' : 'disabled');
    }
    if (dto.emailVerified === true && !user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      changes.push('marked email verified');
    }
    if (dto.emailVerified === false && user.emailVerifiedAt) {
      if (user.id === actor.id) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'You cannot unverify your own super admin account',
        });
      }
      user.emailVerifiedAt = null;
      changes.push('marked email unverified');
    }

    if (changes.length) {
      await this.users.save(user);
      await this.log(actor.id, 'USER_UPDATED', `${changes.join(', ')} ${user.email}`);
    }
    return toPublicUser(user);
  }

  async beginLoginAs(actor: User, userId: string) {
    const target = await this.findUser(userId);
    if (target.id === actor.id) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'You are already signed in as this account',
      });
    }
    if (target.isSuperAdmin) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Super admin accounts cannot be opened this way',
      });
    }
    if (!target.isActive) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Enable this account before opening their panel',
      });
    }

    const tickets = await this.authService.createImpersonationTickets(actor.id, target.id);
    await this.log(actor.id, 'LOGIN_AS', `Opened ${target.email}'s panel`);
    return {
      ticket: tickets.ticket,
      resumeToken: tickets.resumeToken,
      expiresInSeconds: 60,
      user: toPublicUser(target),
    };
  }

  async listLocations(q?: string) {
    const qb = this.locations
      .createQueryBuilder('location')
      .innerJoinAndSelect('location.business', 'business')
      .orderBy('location.createdAt', 'DESC')
      .take(200);
    const term = searchTerm(q);
    if (term) {
      qb.andWhere(
        '(LOWER(location.name) LIKE LOWER(:term) OR LOWER(business.name) LIKE LOWER(:term))',
        { term },
      );
    }
    const rows = await qb.getMany();
    const owners = await this.ownersFor(rows.map((row) => row.business.ownerUserId));
    return rows.map((location) => ({
      id: location.id,
      name: location.name,
      status: location.status,
      address: location.address,
      phone: location.phone,
      slug: location.slug,
      menuMode: location.menuMode,
      reviewCode: location.reviewCode,
      googlePlaceId: location.googlePlaceId,
      scanCount: location.scanCount,
      metricsRefreshedAt: location.metricsRefreshedAt,
      createdAt: location.createdAt,
      business: {
        id: location.business.id,
        name: location.business.name,
        category: location.business.category,
        owner: owners.get(location.business.ownerUserId) ?? null,
      },
    }));
  }

  async updateLocation(actor: User, locationId: string, dto: UpdateAdminLocationDto) {
    const location = await this.findLocation(locationId);
    const changes: string[] = [];
    if (dto.status !== undefined && dto.status !== location.status) {
      location.status = dto.status;
      changes.push(`status ${dto.status}`);
    }
    if (dto.slug !== undefined || dto.menuMode !== undefined) {
      await this.platform.updateLocationFields(actor, locationId, {
        slug: dto.slug,
        menuMode: dto.menuMode,
      });
      if (dto.slug !== undefined) changes.push('slug');
      if (dto.menuMode !== undefined) changes.push('menu mode');
    }
    if (dto.status !== undefined) {
      await this.locations.save(location);
    }
    if (changes.length) {
      await this.log(actor.id, 'LOCATION_UPDATED', `${location.name}: ${changes.join(', ')}`);
    }
    const fresh = await this.findLocation(locationId);
    return {
      id: fresh.id,
      name: fresh.name,
      status: fresh.status,
      slug: fresh.slug,
      menuMode: fresh.menuMode,
    };
  }

  async deleteLocation(actor: User, locationId: string) {
    const location = await this.findLocation(locationId);
    await this.locations.softRemove(location);
    await this.log(actor.id, 'LOCATION_DELETED', `Deleted location ${location.name}`);
    return { deleted: true };
  }

  async transferBusiness(actor: User, businessId: string, emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    const business = await this.businesses.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Business not found',
      });
    }
    const target = await this.users.findOne({ where: { email } });
    if (!target || !target.isActive) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'No active account with that email',
      });
    }
    if (business.ownerUserId === target.id) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This person already owns the business',
      });
    }

    const previousOwnerId = business.ownerUserId;
    await this.users.manager.transaction(async (tx) => {
      business.ownerUserId = target.id;
      await tx.getRepository(Business).save(business);

      const members = tx.getRepository(BusinessMember);
      const nextMember = await members.findOne({
        where: { businessId: business.id, userId: target.id },
      });
      if (nextMember) {
        nextMember.role = MemberRole.BUSINESS_OWNER;
        nextMember.status = MemberStatus.ACTIVE;
        await members.save(nextMember);
      } else {
        await members.save(
          members.create({
            businessId: business.id,
            userId: target.id,
            role: MemberRole.BUSINESS_OWNER,
            status: MemberStatus.ACTIVE,
          }),
        );
      }

      if (previousOwnerId !== target.id) {
        const previous = await members.findOne({
          where: { businessId: business.id, userId: previousOwnerId },
        });
        if (previous) {
          previous.role = MemberRole.BUSINESS_ADMIN;
          previous.status = MemberStatus.DISABLED;
          await members.save(previous);
        }
      }
    });

    await this.log(actor.id, 'BUSINESS_TRANSFERRED', `Transferred ${business.name} to ${target.email}`);
    return {
      id: business.id,
      name: business.name,
      owner: { id: target.id, email: target.email, name: target.name },
    };
  }

  private async findUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User not found',
      });
    }
    return user;
  }

  private async findLocation(locationId: string): Promise<Location> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    return location;
  }

  private async ownersFor(ids: string[]) {
    const unique = [...new Set(ids)];
    const map = new Map<string, { id: string; email: string; name: string }>();
    if (!unique.length) return map;
    const rows = await this.users
      .createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.name'])
      .where('user.id IN (:...unique)', { unique })
      .getMany();
    for (const row of rows) {
      map.set(row.id, { id: row.id, email: row.email, name: row.name });
    }
    return map;
  }

  private async businessCounts(ids: string[]) {
    const map = new Map<string, number>();
    if (!ids.length) return map;
    const rows = await this.businesses
      .createQueryBuilder('business')
      .select('business.ownerUserId', 'ownerUserId')
      .addSelect('COUNT(*)', 'count')
      .where('business.ownerUserId IN (:...ids)', { ids })
      .groupBy('business.ownerUserId')
      .getRawMany<{ ownerUserId: string; count: string }>();
    for (const row of rows) {
      map.set(row.ownerUserId, Number(row.count));
    }
    return map;
  }

  private async log(actorUserId: string, action: string, summary: string) {
    await this.events.save(this.events.create({ actorUserId, action, summary }));
  }
}
