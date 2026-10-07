import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateScannedContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  phones?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(254, { each: true })
  emails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  websites?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  services?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  products?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  other?: string;
}
