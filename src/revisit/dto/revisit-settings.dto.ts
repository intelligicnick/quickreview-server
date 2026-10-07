import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  RevisitCustomerNameMode,
  RevisitLoyaltyScope,
  RevisitVisitFrequency,
} from '../revisit.enums';

export class UpdateRevisitSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(Object.values(RevisitVisitFrequency))
  visitFrequency?: RevisitVisitFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  visitFrequencyHours?: number;

  @IsOptional()
  @IsIn(Object.values(RevisitLoyaltyScope))
  loyaltyScope?: RevisitLoyaltyScope;

  @IsOptional()
  @IsIn(Object.values(RevisitCustomerNameMode))
  customerNameMode?: RevisitCustomerNameMode;

  @IsOptional()
  @IsBoolean()
  otpEnabled?: boolean;
}

export class RevisitRewardInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(9999)
  visitThreshold: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  rewardType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rewardValue?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRevisitRewardsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RevisitRewardInputDto)
  rewards: RevisitRewardInputDto[];
}
