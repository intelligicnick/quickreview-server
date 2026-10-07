import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import {
  generateRawToken,
  hashPassword,
  hashToken,
  sha256Equals,
  verifyPassword,
} from '../common/utils/crypto';
import { MailService } from '../mail/mail.service';
import { toPublicUser } from '../users/user.serializer';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthToken } from './auth-token.entity';
import { AuthTokenType } from './auth-token-type.enum';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export type AuthPayload = {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(AuthToken)
    private readonly tokens: Repository<AuthToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthPayload> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_IN_USE,
        message: 'An account with this email already exists',
      });
    }

    const user = this.usersService.create({
      email,
      name: dto.name.trim(),
      passwordHash: await hashPassword(dto.password),
      emailVerifiedAt: null,
      isActive: true,
      isSuperAdmin: false,
    });
    const saved = await this.usersService.save(user);
    await this.issueEmailVerification(saved);
    return this.issueSession(saved);
  }

  async login(dto: LoginDto): Promise<AuthPayload> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      });
    }
    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }
    return this.issueSession(user);
  }

  async logout(userId: string, rawRefresh?: string): Promise<{ loggedOut: true }> {
    if (rawRefresh) {
      const token = await this.findUsableToken(rawRefresh, AuthTokenType.REFRESH);
      if (token && token.userId === userId) {
        token.consumedAt = new Date();
        await this.tokens.save(token);
      }
    } else {
      await this.consumeAll(userId, AuthTokenType.REFRESH);
    }
    return { loggedOut: true };
  }

  async refresh(rawRefresh: string): Promise<AuthPayload> {
    const token = await this.findUsableToken(rawRefresh, AuthTokenType.REFRESH);
    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid or expired session',
      });
    }
    const user = await this.usersService.findByIdOrFail(token.userId);
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      });
    }
    token.consumedAt = new Date();
    await this.tokens.save(token);
    return this.issueSession(user);
  }

  async verifyEmail(rawToken: string): Promise<ReturnType<typeof toPublicUser>> {
    const token = await this.findUsableToken(rawToken, AuthTokenType.EMAIL_VERIFY);
    if (!token) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid or expired verification link',
      });
    }
    const user = await this.usersService.findByIdOrFail(token.userId);
    user.emailVerifiedAt = new Date();
    await this.usersService.save(user);
    token.consumedAt = new Date();
    await this.tokens.save(token);
    await this.consumeAll(user.id, AuthTokenType.EMAIL_VERIFY);
    return toPublicUser(user);
  }

  async resendVerification(user: User): Promise<{ sent: boolean }> {
    if (user.emailVerifiedAt) {
      return { sent: false };
    }
    await this.issueEmailVerification(user);
    return { sent: true };
  }

  async forgotPassword(emailRaw: string): Promise<{ sent: true }> {
    const email = emailRaw.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive) {
      await this.consumeAll(user.id, AuthTokenType.PASSWORD_RESET);
      const raw = generateRawToken();
      await this.storeToken(user.id, AuthTokenType.PASSWORD_RESET, raw, RESET_TTL_MS);
      const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
      await this.mail.send(
        user.email,
        'Reset your QuickReview password',
        this.mail.resetMessage(appUrl, raw),
      );
    }
    return { sent: true };
  }

  async createImpersonationTickets(
    actorId: string,
    targetId: string,
  ): Promise<{ ticket: string; resumeToken: string }> {
    const ticket = generateRawToken();
    const resumeToken = generateRawToken();
    await this.storeToken(targetId, AuthTokenType.LOGIN_AS, ticket, 60 * 1000);
    await this.storeToken(actorId, AuthTokenType.ADMIN_RESUME, resumeToken, 12 * 60 * 60 * 1000);
    return { ticket, resumeToken };
  }

  async redeemLoginAs(rawTicket: string): Promise<AuthPayload> {
    const token = await this.findUsableToken(rawTicket, AuthTokenType.LOGIN_AS);
    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'This login-as link has expired',
      });
    }
    const user = await this.usersService.findByIdOrFail(token.userId);
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.ACCOUNT_DISABLED,
        message: 'Account is disabled',
      });
    }
    token.consumedAt = new Date();
    await this.tokens.save(token);
    return this.issueSession(user);
  }

  async resumeAdmin(rawResume: string, rawRefresh?: string): Promise<AuthPayload> {
    const resume = await this.findUsableToken(rawResume, AuthTokenType.ADMIN_RESUME);
    if (!resume) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Your super admin session cannot be restored. Sign in again.',
      });
    }
    const user = await this.usersService.findByIdOrFail(resume.userId);
    if (!user.isActive || !user.isSuperAdmin) {
      throw new UnauthorizedException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Super admin access required',
      });
    }
    resume.consumedAt = new Date();
    await this.tokens.save(resume);
    if (rawRefresh) await this.consumeRefresh(rawRefresh);
    return this.issueSession(user);
  }

  async consumeRefresh(raw: string): Promise<void> {
    const token = await this.findUsableToken(raw, AuthTokenType.REFRESH);
    if (!token) return;
    token.consumedAt = new Date();
    await this.tokens.save(token);
  }

  async resetPassword(rawToken: string, password: string): Promise<{ reset: true }> {
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password) || password.length < 8) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Password must be at least 8 characters and include a letter and a number',
      });
    }
    const token = await this.findUsableToken(rawToken, AuthTokenType.PASSWORD_RESET);
    if (!token) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid or expired reset link',
      });
    }
    const user = await this.usersService.findByIdOrFail(token.userId);
    user.passwordHash = await hashPassword(password);
    await this.usersService.save(user);
    token.consumedAt = new Date();
    await this.tokens.save(token);
    await this.consumeAll(user.id, AuthTokenType.REFRESH);
    await this.consumeAll(user.id, AuthTokenType.PASSWORD_RESET);
    return { reset: true };
  }

  private async issueSession(user: User): Promise<AuthPayload> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
          '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    const refreshToken = generateRawToken();
    const refreshTtl = this.parseDuration(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    await this.storeToken(user.id, AuthTokenType.REFRESH, refreshToken, refreshTtl);
    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  private async issueEmailVerification(user: User): Promise<void> {
    await this.consumeAll(user.id, AuthTokenType.EMAIL_VERIFY);
    const raw = generateRawToken();
    await this.storeToken(user.id, AuthTokenType.EMAIL_VERIFY, raw, VERIFY_TTL_MS);
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    await this.mail.send(
      user.email,
      'Verify your QuickReview email',
      this.mail.verificationMessage(appUrl, raw),
    );
  }

  private async storeToken(
    userId: string,
    type: AuthTokenType,
    raw: string,
    ttlMs: number,
  ): Promise<void> {
    const row = this.tokens.create({
      userId,
      type,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + ttlMs),
      consumedAt: null,
    });
    await this.tokens.save(row);
  }

  private async findUsableToken(
    raw: string,
    type: AuthTokenType,
  ): Promise<AuthToken | null> {
    const hash = hashToken(raw.trim());
    const token = await this.tokens.findOne({ where: { tokenHash: hash, type } });
    if (!token || token.consumedAt) return null;
    if (token.expiresAt.getTime() < Date.now()) return null;
    if (!sha256Equals(raw.trim(), token.tokenHash)) return null;
    return token;
  }

  private async consumeAll(userId: string, type: AuthTokenType): Promise<void> {
    await this.tokens
      .createQueryBuilder()
      .update(AuthToken)
      .set({ consumedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('type = :type', { type })
      .andWhere('consumedAt IS NULL')
      .execute();
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }
}
