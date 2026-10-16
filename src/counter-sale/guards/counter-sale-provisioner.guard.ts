import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../../common/constants';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { CounterSaleAgent } from '../counter-sale-agent.entity';
import { COUNTER_SALE_JWT_TYP, CounterSaleJwtPayload } from '../counter-sale-auth.service';

export type CounterSaleProvisionerContext =
  | { kind: 'agent'; agent: CounterSaleAgent }
  | { kind: 'admin'; user: User };

@Injectable()
export class CounterSaleProvisionerGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    @InjectRepository(CounterSaleAgent)
    private readonly agents: Repository<CounterSaleAgent>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      counterSaleProvisioner?: CounterSaleProvisionerContext;
      user?: User;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Sign in required',
      });
    }
    const token = header.slice(7).trim();
    let payload: CounterSaleJwtPayload & { sub: string; email?: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired session',
      });
    }

    if (payload.typ === COUNTER_SALE_JWT_TYP) {
      const agent = await this.agents.findOne({ where: { id: payload.sub } });
      if (!agent?.isActive) {
        throw new UnauthorizedException({
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or expired session',
        });
      }
      request.counterSaleProvisioner = { kind: 'agent', agent };
      return true;
    }

    const user = await this.users.findById(payload.sub);
    if (!user?.isActive || !user.isSuperAdmin) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Super admin or counter-sale agent access required',
      });
    }
    request.user = user;
    request.counterSaleProvisioner = { kind: 'admin', user };
    return true;
  }
}
