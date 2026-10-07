import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BusinessCategory } from '../../catalog/business-category.enum';
import { LocationMenuMode } from '../../locations/location-menu-mode.enum';

export class UpdateMenuSettingsDto {
  @IsOptional()
  @IsEnum(LocationMenuMode)
  menuMode?: LocationMenuMode;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;
}

export class QuickCommerceSetupDto {
  @IsIn(Object.values(BusinessCategory))
  businessCategory!: BusinessCategory;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIn(Object.values(BusinessCategory), { each: true })
  businessSubcategories?: BusinessCategory[];
}

export class CreateMenuCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class MenuCategoryPriceVariantDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class MenuItemVariantPriceDto {
  @IsUUID('4')
  variantId!: string;

  @IsNumber()
  priceInr!: number;
}

export class MenuItemPriceOptionDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsNumber()
  priceInr!: number;
}

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuCategoryPriceVariantDto)
  priceVariants?: MenuCategoryPriceVariantDto[];
}

export class CreateMenuItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  priceInr?: number | null;

  @IsOptional()
  @IsBoolean()
  isNonVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantPriceDto)
  variantPrices?: MenuItemVariantPriceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuItemPriceOptionDto)
  itemPriceOptions?: MenuItemPriceOptionDto[];
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  priceInr?: number | null;

  @IsOptional()
  @IsBoolean()
  isNonVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== '')
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuItemVariantPriceDto)
  variantPrices?: MenuItemVariantPriceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => MenuItemPriceOptionDto)
  itemPriceOptions?: MenuItemPriceOptionDto[];
}
