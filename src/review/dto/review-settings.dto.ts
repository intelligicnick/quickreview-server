import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ArrayMaxSize } from 'class-validator';

export class UpdateReviewSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  keywords?: string[];
}

export class SuggestReviewDraftsDto {
  @IsInt()
  @Min(4)
  @Max(5)
  stars: number;
}
