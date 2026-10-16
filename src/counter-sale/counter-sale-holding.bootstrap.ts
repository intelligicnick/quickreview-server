import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../common/utils/crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CounterSaleHoldingBootstrap implements OnModuleInit {
  private readonly logger = new Logger(CounterSaleHoldingBootstrap.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') return;

    const email =
      this.config.get<string>('COUNTER_SALE_OWNER_EMAIL')?.toLowerCase().trim() ||
      this.config.get<string>('SUPER_ADMIN_EMAIL')?.toLowerCase().trim();
    if (!email) return;

    let user = await this.users.findByEmail(email);
    if (user) return;

    const password = this.config.get<string>('COUNTER_SALE_OWNER_PASSWORD');
    if (!password || password.length < 8) {
      this.logger.warn(
        `Counter-sale holding account ${email} does not exist. Set COUNTER_SALE_OWNER_PASSWORD (8+ chars) or use an existing account email.`,
      );
      return;
    }

    user = this.users.create({
      email,
      name: this.config.get<string>('COUNTER_SALE_OWNER_NAME')?.trim() || 'Counter sale holding',
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      isActive: true,
      isSuperAdmin: false,
    });
    await this.users.save(user);
    this.logger.log(`Created counter-sale holding account ${email}`);
  }
}
