import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { ReviewService } from '../review/review.service';
import { User } from '../users/user.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { Location } from './location.entity';
import { LocationStatus } from './location-status.enum';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    private readonly membersService: MembersService,
    private readonly reviewService: ReviewService,
  ) {}

  async create(user: User, businessId: string, dto: CreateLocationDto): Promise<Location> {
    await this.membersService.assertMember(user, businessId, MANAGER_ROLES);
    const location = this.locations.create({
      businessId,
      name: dto.name.trim(),
      address: dto.address?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.toLowerCase().trim() || null,
      googleReviewUrl: dto.googleReviewUrl?.trim() || null,
      gbpLocationName: dto.gbpLocationName?.trim() || null,
      menuMode: dto.menuMode,
      reviewCode: await this.reviewService.allocateCode(),
      status: LocationStatus.ACTIVE,
    });
    this.reviewService.applyGoogleFields(location, dto.googleReviewUrl, dto.googlePlaceId);
    return this.locations.save(location);
  }

  async list(user: User, businessId: string): Promise<Location[]> {
    await this.membersService.assertMember(user, businessId);
    return this.locations.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOne(user: User, locationId: string): Promise<Location> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Location not found',
      });
    }
    await this.membersService.assertMember(user, location.businessId);
    return location;
  }

  async update(user: User, locationId: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.getOne(user, locationId);
    await this.membersService.assertMember(user, location.businessId, MANAGER_ROLES);
    if (dto.name !== undefined) location.name = dto.name.trim();
    if (dto.address !== undefined) location.address = dto.address.trim() || null;
    if (dto.phone !== undefined) location.phone = dto.phone.trim() || null;
    if (dto.email !== undefined) location.email = dto.email.toLowerCase().trim() || null;
    if (dto.googleReviewUrl !== undefined || dto.googlePlaceId !== undefined) {
      this.reviewService.applyGoogleFields(
        location,
        dto.googleReviewUrl !== undefined ? dto.googleReviewUrl : location.googleReviewUrl,
        dto.googlePlaceId,
      );
    }
    if (dto.status !== undefined) location.status = dto.status;
    return this.locations.save(location);
  }
}
