import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RecordReviewEventDto {
  @IsIn(['page_view', 'star', 'private', 'google_open'])
  type: 'page_view' | 'star' | 'private' | 'google_open';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stars?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
