import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaymentProvider } from '../enums/payment-provider.enum';

export class StartCheckoutDto {
  @ValidateIf((dto: StartCheckoutDto) => !dto.planIds?.length)
  @IsUUID('4')
  planId?: string;

  @ValidateIf((dto: StartCheckoutDto) => !dto.planId)
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsUUID('4', { each: true })
  planIds?: string[];

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;
}
