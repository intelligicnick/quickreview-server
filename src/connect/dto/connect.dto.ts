import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ConnectLinkType } from '../connect-link-type.enum';

export class UpdateConnectProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappPhone?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  coverImageUrl?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  profileImageUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;
}

export class CreateConnectLinkDto {
  @IsEnum(ConnectLinkType)
  type: ConnectLinkType;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label: string;

  @IsString()
  @MinLength(4)
  @MaxLength(1000)
  url: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateConnectLinkDto {
  @IsOptional()
  @IsEnum(ConnectLinkType)
  type?: ConnectLinkType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(1000)
  url?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateConnectLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
