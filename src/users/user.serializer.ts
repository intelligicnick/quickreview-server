import { User } from './user.entity';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
  };
}
