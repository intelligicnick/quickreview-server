import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../common/utils/crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminBootstrap implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrap.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') === 'test') return;

    const email = this.config.get<string>('SUPER_ADMIN_EMAIL')?.toLowerCase().trim();
    if (!email) return;

    const password = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    const name = this.config.get<string>('SUPER_ADMIN_NAME')?.trim() || 'Super Admin';
    let user = await this.users.findByEmail(email);

    if (!user) {
      if (!password || password.length < 8) {
        this.logger.warn(
          `SUPER_ADMIN_EMAIL is ${email}, but that account does not exist. Register it, or set SUPER_ADMIN_PASSWORD (8+ characters) and restart.`,
        );
        return;
      }
      user = this.users.create({
        email,
        name,
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(),
        isActive: true,
        isSuperAdmin: true,
      });
      await this.users.save(user);
      this.logger.log(`Created super admin ${email}`);
      return;
    }

    this.logger.warn(
      `SUPER_ADMIN_EMAIL matches existing user ${email}; skipping auto-promote. Grant isSuperAdmin manually or use a dedicated bootstrap email.`,
    );
  }
}
