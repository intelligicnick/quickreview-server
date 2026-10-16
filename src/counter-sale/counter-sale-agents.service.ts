import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { User } from '../users/user.entity';
import { CounterSaleAgent } from './counter-sale-agent.entity';
import { CounterSaleProvision } from './counter-sale-provision.entity';
import { CounterSaleAuthService } from './counter-sale-auth.service';
import { CounterSaleHoldingService } from './counter-sale-holding.service';
import { CreateCounterSaleAgentDto, UpdateCounterSaleAgentDto } from './dto/counter-sale.dto';
import { Business } from '../businesses/business.entity';
import { Location } from '../locations/location.entity';

@Injectable()
export class CounterSaleAgentsService {
  constructor(
    @InjectRepository(CounterSaleAgent) private readonly agents: Repository<CounterSaleAgent>,
    @InjectRepository(CounterSaleProvision) private readonly provisions: Repository<CounterSaleProvision>,
    @InjectRepository(Business) private readonly businesses: Repository<Business>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly auth: CounterSaleAuthService,
    private readonly holding: CounterSaleHoldingService,
  ) {}

  async listAgents() {
    const rows = await this.agents.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      isActive: row.isActive,
      createdAt: row.createdAt,
    }));
  }

  async createAgent(actor: User, dto: CreateCounterSaleAgentDto) {
    const username = dto.username.trim().toLowerCase();
    const exists = await this.agents.exist({ where: { username } });
    if (exists) {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: 'Username is already taken',
      });
    }
    const agent = await this.agents.save(
      this.agents.create({
        username,
        pinHash: await this.auth.hashPin(dto.pin),
        isActive: true,
        createdByUserId: actor.id,
      }),
    );
    return { id: agent.id, username: agent.username, isActive: agent.isActive };
  }

  mintAgentSession(agentId: string) {
    return this.auth.mintSessionForAgentId(agentId);
  }

  async updateAgent(agentId: string, dto: UpdateCounterSaleAgentDto) {
    const agent = await this.agents.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Agent not found',
      });
    }
    agent.isActive = dto.isActive;
    await this.agents.save(agent);
    return { id: agent.id, username: agent.username, isActive: agent.isActive };
  }

  async listProvisions(q?: string) {
    const holdingUser = await this.holding.getHoldingUser();
    const qb = this.provisions
      .createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC')
      .take(200);

    const rows = await qb.getMany();
    const businessIds = [...new Set(rows.map((r) => r.businessId))];
    const locationIds = [...new Set(rows.map((r) => r.locationId))];

    const businesses =
      businessIds.length > 0
        ? await this.businesses.find({ where: { id: In(businessIds) } })
        : [];
    const locations =
      locationIds.length > 0
        ? await this.locations.find({ where: { id: In(locationIds) } })
        : [];

    const businessMap = new Map(businesses.map((b) => [b.id, b]));
    const locationMap = new Map(locations.map((l) => [l.id, l]));

    const term = (q ?? '').trim().toLowerCase();
    return rows
      .map((row) => {
        const business = businessMap.get(row.businessId);
        const location = locationMap.get(row.locationId);
        return {
          id: row.id,
          qrCode: row.qrCode,
          service: row.service,
          createdAt: row.createdAt,
          business: business
            ? {
                id: business.id,
                name: business.name,
                ownerUserId: business.ownerUserId,
                onHoldingAccount: business.ownerUserId === holdingUser.id,
              }
            : null,
          location: location
            ? {
                id: location.id,
                name: location.name,
                googleReviewUrl: location.googleReviewUrl,
                googlePlaceId: location.googlePlaceId,
                address: location.address,
              }
            : null,
        };
      })
      .filter((row) => {
        if (!term) return true;
        const hay = [
          row.qrCode,
          row.location?.name,
          row.location?.address,
          row.business?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
  }
}
