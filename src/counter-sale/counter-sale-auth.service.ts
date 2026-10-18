import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
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

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const SESSION_TICKET_TTL_MS = 60_000;

type LoginGuardState = { failures: number; lockedUntil: number };

@Injectable()
export class CounterSaleAuthService {
  // ponytail: in-process lockout; Redis if multi-instance
  private readonly loginGuard = new Map<string, LoginGuardState>();
  private readonly sessionTickets = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(CounterSaleAgent)
    private readonly agents: Repository<CounterSaleAgent>,
  ) {}

  async login(dto: CounterSaleLoginDto) {
    const username = dto.username.trim().toLowerCase();
    this.assertNotLocked(username);

    const agent = await this.agents.findOne({ where: { username } });
    if (!agent?.isActive) {
      this.recordFailedLogin(username);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or PIN',
      });
    }
    const ok = await verifyPassword(dto.pin, agent.pinHash);
    if (!ok) {
      this.recordFailedLogin(username);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid username or PIN',
      });
    }
    this.clearLoginGuard(username);
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
    const ticket = this.issueSessionTicket(await this.signAccessToken(agent));
    return {
      ticket,
      agent: { id: agent.id, username: agent.username },
    };
  }

  redeemSessionTicket(ticket: string) {
    const key = ticket.trim();
    const row = this.sessionTickets.get(key);
    this.sessionTickets.delete(key);
    if (!row || row.expiresAt < Date.now()) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Session link has expired',
      });
    }
    return { accessToken: row.token };
  }

  private issueSessionTicket(accessToken: string): string {
    const ticket = randomBytes(24).toString('base64url');
    this.sessionTickets.set(ticket, {
      token: accessToken,
      expiresAt: Date.now() + SESSION_TICKET_TTL_MS,
    });
    return ticket;
  }

  private assertNotLocked(username: string): void {
    const state = this.loginGuard.get(username);
    if (state && state.lockedUntil > Date.now()) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Too many failed attempts. Try again later.',
      });
    }
  }

  private recordFailedLogin(username: string): void {
    const now = Date.now();
    const prev = this.loginGuard.get(username);
    const failures = (prev && prev.lockedUntil <= now ? 0 : prev?.failures ?? 0) + 1;
    if (failures >= MAX_FAILED_LOGINS) {
      this.loginGuard.set(username, { failures, lockedUntil: now + LOCKOUT_MS });
      return;
    }
    this.loginGuard.set(username, { failures, lockedUntil: 0 });
  }

  private clearLoginGuard(username: string): void {
    this.loginGuard.delete(username);
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
