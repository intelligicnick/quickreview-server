import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_UNVERIFIED_KEY } from '../../common/decorators/allow-unverified.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ERROR_CODES } from '../../common/constants';
import { User } from '../../users/user.entity';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowUnverified) return true;

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    if (!request.user?.emailVerifiedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        message: 'Verify your email to continue',
      });
    }
    return true;
  }
}
