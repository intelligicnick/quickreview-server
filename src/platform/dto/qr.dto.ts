import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ClaimQrCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code: string;

  @IsIn(['review', 'menu', 'revisit'])
  kind: 'review' | 'menu' | 'revisit';
}
