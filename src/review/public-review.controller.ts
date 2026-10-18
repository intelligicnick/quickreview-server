import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RecordReviewEventDto } from './dto/public-review.dto';
import { SuggestReviewDraftsDto } from './dto/review-settings.dto';
import { ReviewService } from './review.service';

@Controller('public/r')
@Public()
export class PublicReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get(':code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getPage(@Param('code') code: string) {
    return this.reviewService.getPublicPage(code);
  }

  @Post(':code/events')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  record(@Param('code') code: string, @Body() dto: RecordReviewEventDto) {
    return this.reviewService.recordPublicEvent(code, dto);
  }

  @Post(':code/suggestions')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  suggestions(
    @Param('code') code: string,
    @Body() dto: SuggestReviewDraftsDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    return this.reviewService.suggestPublicDrafts(code, dto, clientIp);
  }
}
