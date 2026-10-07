import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  DESIGN_ASPECT_RATIOS,
  DESIGN_LOOKS,
  DESIGN_PICTURE_MODES,
  DESIGN_TEMPLATES,
  type DesignAspectRatio,
  type DesignLook,
  type DesignPictureMode,
  type DesignTemplate,
} from '../design.constants';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class GenerateDesignDto {
  @IsIn(DESIGN_TEMPLATES)
  template: DesignTemplate;

  @IsOptional()
  @IsIn(DESIGN_LOOKS)
  look?: DesignLook;

  @IsOptional()
  @IsIn(DESIGN_PICTURE_MODES)
  picture?: DesignPictureMode;

  @IsOptional()
  @IsIn(DESIGN_ASPECT_RATIOS)
  aspectRatio?: DesignAspectRatio;

  @IsOptional()
  @IsBoolean()
  includeBusinessName?: boolean;

  @IsOptional()
  @IsBoolean()
  includePhone?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  businessName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(24)
  phoneNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  offerText?: string;

  @ValidateIf((dto: GenerateDesignDto) => dto.template === 'festival')
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  festival?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16_000_000)
  importedImageBase64?: string;
}
