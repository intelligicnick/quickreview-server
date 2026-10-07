import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LocationMenuMode } from '../../locations/location-menu-mode.enum';
import { LocationStatus } from '../../locations/location-status.enum';
import { MarketplaceOrderStatus } from '../../platform/enums/marketplace-order-status.enum';
import { PaymentProvider } from '../../platform/enums/payment-provider.enum';
import { PaymentStatus } from '../../platform/enums/payment-status.enum';
import { SubscriptionStatus } from '../../platform/enums/subscription-status.enum';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['unverified', 'disabled', 'active'])
  status?: 'unverified' | 'disabled' | 'active';
}

export class AdminLocationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}

export class UpdateAdminLocationDto {
  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string | null;

  @IsOptional()
  @IsEnum(LocationMenuMode)
  menuMode?: LocationMenuMode;
}

export class TransferBusinessDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class AdminPaymentsQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}

export class AdminSubscriptionsQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}

export class AdminOrdersQueryDto {
  @IsOptional()
  @IsEnum(MarketplaceOrderStatus)
  status?: MarketplaceOrderStatus;
}

export class AdminQrCodesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  batchId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  unassigned?: 'true' | 'false';
}

export class UpdatePlanDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  amountInr?: number;
}

export class GrantCompSubscriptionDto {
  @IsUUID('4')
  locationId: string;

  @IsUUID('4')
  planId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateManualPaymentDto {
  @IsUUID('4')
  locationId: string;

  @IsUUID('4')
  planId: string;

  @IsIn([PaymentProvider.UPI, PaymentProvider.CASH])
  provider: PaymentProvider.UPI | PaymentProvider.CASH;
}

export class MarkPaymentPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  note?: string;
}

export class UpdateQrProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dimensions?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceInr?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateQrProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dimensions?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsInt()
  @Min(0)
  priceInr: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMarketplaceCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMarketplaceCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMarketplaceOrderDto {
  @IsEnum(MarketplaceOrderStatus)
  status: MarketplaceOrderStatus;
}

export class CreateQrBatchDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  size?: number;
}

export class AssignQrCodeDto {
  @IsUUID('4')
  locationId: string;

  @IsIn(['review', 'menu'])
  kind: 'review' | 'menu';
}

export class SetQrPrintedDto {
  @IsBoolean()
  isPrinted: boolean;
}

export class AdminContactQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  open?: 'true' | 'false';
}
