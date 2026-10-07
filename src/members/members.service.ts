import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { User } from '../users/user.entity';
import { BusinessMember } from './business-member.entity';
import { ALL_MEMBER_ROLES, MemberRole } from './member-role.enum';
import { MemberStatus } from './member-status.enum';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(BusinessMember)
    private readonly members: Repository<BusinessMember>,
  ) {}

  async createOwner(businessId: string, userId: string): Promise<BusinessMember> {
    const member = this.members.create({
      businessId,
      userId,
      role: MemberRole.BUSINESS_OWNER,
      status: MemberStatus.ACTIVE,
    });
    return this.members.save(member);
  }

  async listForUser(userId: string): Promise<BusinessMember[]> {
    return this.members.find({
      where: { userId, status: MemberStatus.ACTIVE },
      relations: ['business'],
      order: { createdAt: 'DESC' },
    });
  }

  async listForBusiness(businessId: string): Promise<BusinessMember[]> {
    return this.members.find({
      where: { businessId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async assertMember(
    user: User,
    businessId: string,
    allowedRoles: MemberRole[] = ALL_MEMBER_ROLES,
  ): Promise<BusinessMember | null> {
    if (user.isSuperAdmin) {
      return null;
    }

    const member = await this.members.findOne({
      where: { businessId, userId: user.id },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Business not found',
      });
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to do that',
      });
    }

    return member;
  }
}
