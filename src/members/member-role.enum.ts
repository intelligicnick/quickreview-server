export enum MemberRole {
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  BUSINESS_ADMIN = 'BUSINESS_ADMIN',
  STAFF = 'STAFF',
}

export const MANAGER_ROLES: MemberRole[] = [
  MemberRole.BUSINESS_OWNER,
  MemberRole.BUSINESS_ADMIN,
];

export const ALL_MEMBER_ROLES: MemberRole[] = [
  MemberRole.BUSINESS_OWNER,
  MemberRole.BUSINESS_ADMIN,
  MemberRole.STAFF,
];
