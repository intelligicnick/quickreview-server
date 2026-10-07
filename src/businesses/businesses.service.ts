import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { User } from '../users/user.entity';
import { Business } from './business.entity';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/create-business.dto';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    private readonly membersService: MembersService,
  ) {}

  async create(user: User, dto: CreateBusinessDto): Promise<Business> {
    const business = this.businesses.create({
      name: dto.name.trim(),
      category: dto.category?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.toLowerCase().trim() || null,
      website: dto.website?.trim() || null,
      address: dto.address?.trim() || null,
      googleReviewUrl: dto.googleReviewUrl?.trim() || null,
      ownerUserId: user.id,
      isActive: true,
    });
    const saved = await this.businesses.save(business);
    await this.membersService.createOwner(saved.id, user.id);
    return saved;
  }

  async listForUser(user: User): Promise<Business[]> {
    if (user.isSuperAdmin) {
      return this.businesses.find({ order: { createdAt: 'DESC' } });
    }
    const memberships = await this.membersService.listForUser(user.id);
    return memberships
      .map((m) => m.business)
      .filter((business): business is Business => Boolean(business) && business.isActive);
  }

  async getOne(user: User, businessId: string): Promise<Business> {
    await this.membersService.assertMember(user, businessId);
    const business = await this.businesses.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Business not found',
      });
    }
    return business;
  }

  async update(user: User, businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    await this.membersService.assertMember(user, businessId, MANAGER_ROLES);
    const business = await this.getOne(user, businessId);
    if (dto.name !== undefined) business.name = dto.name.trim();
    if (dto.category !== undefined) business.category = dto.category.trim() || null;
    if (dto.phone !== undefined) business.phone = dto.phone.trim() || null;
    if (dto.email !== undefined) business.email = dto.email.toLowerCase().trim() || null;
    if (dto.website !== undefined) business.website = dto.website.trim() || null;
    if (dto.address !== undefined) business.address = dto.address.trim() || null;
    if (dto.googleReviewUrl !== undefined) {
      business.googleReviewUrl = dto.googleReviewUrl.trim() || null;
    }
    return this.businesses.save(business);
  }

  async listMembers(user: User, businessId: string) {
    await this.membersService.assertMember(user, businessId);
    const members = await this.membersService.listForBusiness(businessId);
    return members.map((member) => ({
      id: member.id,
      role: member.role,
      status: member.status,
      user: member.user
        ? {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          }
        : null,
      createdAt: member.createdAt,
    }));
  }
}
