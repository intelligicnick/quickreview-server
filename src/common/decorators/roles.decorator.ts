import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '../../members/member-role.enum';

export const MEMBER_ROLES_KEY = 'memberRoles';
export const RequireRoles = (...roles: MemberRole[]) => SetMetadata(MEMBER_ROLES_KEY, roles);
