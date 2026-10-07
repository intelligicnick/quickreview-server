import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class StartCheckoutDto {
  @IsUUID('4')
  planId: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}
