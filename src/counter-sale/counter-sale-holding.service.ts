import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '../common/constants';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class CounterSaleHoldingService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  holdingEmail(): string | null {
    return (
      this.config.get<string>('COUNTER_SALE_OWNER_EMAIL')?.toLowerCase().trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.toLowerCase().trim() ||
      null
    );
  }

  async getHoldingUser(): Promise<User> {
    const email = this.holdingEmail();
    if (!email) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Counter-sale holding account is not configured',
      });
    }
    const user = await this.users.findByEmail(email);
    if (!user?.isActive) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `Counter-sale holding account (${email}) is missing or inactive`,
      });
    }
    return user;
  }

  isHoldingOwner(userId: string, holdingUserId: string): boolean {
    return userId === holdingUserId;
  }
}
