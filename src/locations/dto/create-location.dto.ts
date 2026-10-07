import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LocationMenuMode } from '../location-menu-mode.enum';
import { LocationStatus } from '../location-status.enum';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  googleReviewUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gbpLocationName?: string;

  @IsOptional()
  @IsEnum(LocationMenuMode)
  menuMode?: LocationMenuMode;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  googleReviewUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  googlePlaceId?: string;

  @IsOptional()
  @IsEnum(LocationStatus)
  status?: LocationStatus;
}
