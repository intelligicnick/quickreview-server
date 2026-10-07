import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RevisitCheckInDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  mobile: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;
}
