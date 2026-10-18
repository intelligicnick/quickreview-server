import { IsBoolean, IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CounterSaleServiceKind } from '../counter-sale-service.enum';

export class CounterSaleLoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Matches(/^\d{5}$/)
  pin!: string;
}

export class CreateCounterSaleAgentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/)
  username!: string;

  @IsString()
  @Matches(/^\d{5}$/)
  pin!: string;
}

export class CounterSaleSessionTicketDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  ticket!: string;
}

export class UpdateCounterSaleAgentDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateCounterSaleAgentPinDto {
  @IsString()
  @Matches(/^\d{5}$/)
  pin!: string;
}

export class CounterSaleProvisionDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  qrCode!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  placeId!: string;

  @IsIn([CounterSaleServiceKind.REVIEW, CounterSaleServiceKind.MENU])
  service!: CounterSaleServiceKind;
}

export class CounterSalePlacesQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  q!: string;
}

export class CounterSaleQrLookupQueryDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  code!: string;
}
