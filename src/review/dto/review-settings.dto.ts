import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateReviewSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  reviewQuestions?: string[];
}

export class ReviewDraftAnswerDto {
  @IsString()
  @MaxLength(120)
  question: string;

  @IsString()
  @MaxLength(500)
  answer: string;
}

export class SuggestReviewDraftsDto {
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(5)
  stars: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ReviewDraftAnswerDto)
  @Transform(({ value }) => (value == null ? [] : value))
  answers?: ReviewDraftAnswerDto[];
}
