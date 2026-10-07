import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class PlaceMarketplaceOrderDto {
  @IsUUID('4')
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  designName?: string;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
