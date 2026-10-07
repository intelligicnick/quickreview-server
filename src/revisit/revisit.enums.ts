export enum RevisitVisitFrequency {
  ONCE_PER_DAY = 'once_per_day',
  EVERY_X_HOURS = 'every_x_hours',
  UNLIMITED = 'unlimited',
}

export enum RevisitLoyaltyScope {
  BUSINESS_WIDE = 'business_wide',
  PER_LOCATION = 'per_location',
}

export enum RevisitCustomerNameMode {
  OPTIONAL = 'optional',
  REQUIRED = 'required',
}

export enum RevisitRewardStatus {
  UNLOCKED = 'unlocked',
  REDEEMED = 'redeemed',
}

export const REVISIT_SOURCE = 'quick_revisit';
