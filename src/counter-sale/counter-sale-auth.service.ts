import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { hashPassword, verifyPassword } from '../common/utils/crypto';
import { CounterSaleAgent } from './counter-sale-agent.entity';
import { CounterSaleLoginDto } from './dto/counter-sale.dto';

export const COUNTER_SALE_JWT_TYP = 'counter_sale';

export type CounterSaleJwtPayload = {
  sub: string;
  typ: typeof COUNTER_SALE_JWT_TYP;
};

@Injectable()
export class CounterSaleAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(CounterSaleAgent)
    private readonly agents: Repository<CounterSaleAgent>,
  ) {}

  async login(dto: CounterSaleLoginDto) {
    const username = dto.username.trim().toLowerCase();
    const agent = await this.agents.findOne({ where: { username } });
    if (!agent?.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or PIN',
      });
    }
    const ok = await verifyPassword(dto.pin, agent.pinHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or PIN',
      });
    }
    const accessToken = await this.signAccessToken(agent);
    return {
      accessToken,
      agent: { id: agent.id, username: agent.username },
    };
  }

  async mintSessionForAgentId(agentId: string) {
    const agent = await this.agents.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new NotFoundException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Agent not found',
      });
    }
    if (!agent.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Agent is disabled',
      });
    }
    const accessToken = await this.signAccessToken(agent);
    return {
      accessToken,
      agent: { id: agent.id, username: agent.username },
    };
  }

  private async signAccessToken(agent: CounterSaleAgent): Promise<string> {
    return this.jwt.signAsync(
      { sub: agent.id, typ: COUNTER_SALE_JWT_TYP } satisfies CounterSaleJwtPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '12h',
      },
    );
  }

  async hashPin(pin: string): Promise<string> {
    return hashPassword(pin);
  }
}
