import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

  @IsOptional()
  @IsBoolean()
  askUnhappyPhone?: boolean;
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

  /** Client session id — limits “Frame my review” to 2 calls per visit. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  frameSessionId?: string;

  /** Prior drafts to avoid repeating on “New wordings”. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  excludeDrafts?: string[];
}
