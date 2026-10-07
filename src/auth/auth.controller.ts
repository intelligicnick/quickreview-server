import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AllowUnverified } from '../common/decorators/allow-unverified.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { REFRESH_COOKIE } from '../common/constants';
import { toPublicUser } from '../users/user.serializer';
import { User } from '../users/user.entity';
import { AuthPayload, AuthService } from './auth.service';
import { ForgotPasswordDto, RefreshDto, ResetPasswordDto, TokenDto } from './dto/token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.authService.register(dto);
    this.setRefreshCookie(res, payload.refreshToken);
    return this.toClient(payload);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const payload = await this.authService.login(dto);
    this.setRefreshCookie(res, payload.refreshToken);
    return this.toClient(payload);
  }

  @AllowUnverified()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = this.readRefresh(req);
    await this.authService.logout(user.id, raw);
    this.clearRefreshCookie(res);
    return { loggedOut: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = dto.refreshToken ?? this.readRefresh(req);
    if (!raw) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Missing refresh token',
      });
    }
    const payload = await this.authService.refresh(raw);
    this.setRefreshCookie(res, payload.refreshToken);
    return this.toClient(payload);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: TokenDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @AllowUnverified()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resend(@CurrentUser() user: User) {
    return this.authService.resendVerification(user);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('login-as')
  @HttpCode(HttpStatus.OK)
  async loginAs(@Body() dto: TokenDto, @Res({ passthrough: true }) res: Response) {
    const payload = await this.authService.redeemLoginAs(dto.token);
    this.setRefreshCookie(res, payload.refreshToken);
    return this.toClient(payload);
  }

  @Public()
  @Post('resume-admin')
  @HttpCode(HttpStatus.OK)
  async resumeAdmin(
    @Body() dto: TokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.authService.resumeAdmin(dto.token, this.readRefresh(req));
    this.setRefreshCookie(res, payload.refreshToken);
    return this.toClient(payload);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @AllowUnverified()
  @Get('me')
  me(@CurrentUser() user: User) {
    return toPublicUser(user);
  }

  private toClient(payload: AuthPayload) {
    return {
      user: payload.user,
      accessToken: payload.accessToken,
    };
  }

  private readRefresh(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    const fromCookie = cookies?.[REFRESH_COOKIE];
    return fromCookie || undefined;
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }
}
