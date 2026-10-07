import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { User } from '../users/user.entity';
import { decryptSecret, encryptSecret } from './google-crypto.util';
import { UserGoogleConnection } from './entities/user-google-connection.entity';

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
  'profile',
];

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserGoogleConnection)
    private readonly connections: Repository<UserGoogleConnection>,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() &&
        this.redirectUri(),
    );
  }

  redirectUri(): string {
    const explicit = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')?.trim();
    if (explicit) return explicit;
    const port = this.config.get<string>('PORT') ?? '3001';
    return `http://localhost:${port}/api/google/oauth/callback`;
  }

  async getConnection(userId: string): Promise<UserGoogleConnection | null> {
    return this.connections.findOne({ where: { userId } });
  }

  async disconnect(user: User): Promise<void> {
    await this.connections.delete({ userId: user.id });
  }

  buildAuthorizationUrl(user: User): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Google OAuth is not configured on the server',
      });
    }
    const state = this.signState(user.id);
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<User> {
    const userId = this.verifyState(state);
    const tokens = await this.exchangeCode(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Google did not return a refresh token. Disconnect the app in Google Account settings and try again.',
      });
    }
    const secret = this.tokenEncryptionKey();
    let googleEmail: string | null = null;
    if (tokens.access_token) {
      googleEmail = await this.fetchGoogleEmail(tokens.access_token);
    }
    const existing = await this.connections.findOne({ where: { userId } });
    const enc = encryptSecret(tokens.refresh_token, secret);
    const expiresAt =
      typeof tokens.expires_in === 'number'
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;
    if (existing) {
      existing.refreshTokenEnc = enc;
      existing.googleEmail = googleEmail;
      existing.tokenExpiresAt = expiresAt;
      await this.connections.save(existing);
    } else {
      const row = this.connections.create({
        userId,
        refreshTokenEnc: enc,
        googleEmail,
        tokenExpiresAt: expiresAt,
      });
      row.assignId();
      await this.connections.save(row);
    }
    const user = await this.connections.manager.findOne(User, { where: { id: userId } });
    if (!user) {
      throw new BadRequestException({
        code: ERROR_CODES.NOT_FOUND,
        message: 'User not found for Google connection',
      });
    }
    return user;
  }

  async getAccessToken(userId: string): Promise<string> {
    const connection = await this.connections.findOne({ where: { userId } });
    if (!connection) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Connect Google Business Profile first',
      });
    }
    const refreshToken = decryptSecret(connection.refreshTokenEnc, this.tokenEncryptionKey());
    const tokens = await this.refreshAccessToken(refreshToken);
    if (tokens.expires_in) {
      connection.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await this.connections.save(connection);
    }
    if (!tokens.access_token) {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Could not refresh Google access token',
      });
    }
    return tokens.access_token;
  }

  private tokenEncryptionKey(): string {
    return (
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY')?.trim() ||
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
    );
  }

  private signState(userId: string): string {
    const nonce = randomBytes(16).toString('base64url');
    const exp = String(Math.floor(Date.now() / 1000) + 600);
    const payload = `${userId}.${exp}.${nonce}`;
    const sig = createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): string {
    const parts = state.split('.');
    if (parts.length !== 4) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid OAuth state',
      });
    }
    const [userId, expStr, nonce, sig] = parts;
    const payload = `${userId}.${expStr}.${nonce}`;
    const expected = createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'Invalid OAuth state',
      });
    }
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_TOKEN,
        message: 'OAuth state expired',
      });
    }
    return userId;
  }

  private async exchangeCode(code: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirect_uri: this.redirectUri(),
      grant_type: 'authorization_code',
    });
    return this.postToken(body);
  }

  private async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    });
    return this.postToken(body);
  }

  private async postToken(body: URLSearchParams): Promise<TokenResponse> {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token request failed';
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      });
    }
    const json = (await response.json()) as TokenResponse;
    if (!response.ok) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: json.error_description ?? json.error ?? 'Google token exchange failed',
      });
    }
    return json;
  }

  private async fetchGoogleEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      const json = (await response.json()) as { email?: string };
      return json.email?.trim() || null;
    } catch {
      return null;
    }
  }
}
