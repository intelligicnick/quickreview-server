import { IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportGoogleItemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  placeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gbpLocationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
}

export class ImportGoogleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  businessName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGoogleItemDto)
  items: ImportGoogleItemDto[];
}

export class PlacesSearchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  query: string;
}
