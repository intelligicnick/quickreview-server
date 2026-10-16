import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  GoogleReviewGrowthService,
  type ReviewGrowthRange,
} from '../google/google-review-growth.service';
import { User } from '../users/user.entity';
import { UpdateReviewSettingsDto } from './dto/review-settings.dto';
import { ReviewService } from './review.service';

@Controller('locations')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewGrowthService: GoogleReviewGrowthService,
  ) {}

  @Get(':locationId/quickreview')
  summary(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.reviewService.merchantSummary(user, locationId);
  }

  @Get(':locationId/quickreview/review-growth')
  reviewGrowth(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Query('range') range?: string,
  ) {
    const normalized: ReviewGrowthRange =
      range === '7' || range === '30' || range === '90' || range === 'all' ? range : '30';
    return this.reviewGrowthService.merchantGrowth(user, locationId, normalized);
  }

  @Get(':locationId/quickreview/settings')
  settings(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.reviewService.getReviewSettings(user, locationId);
  }

  @Patch(':locationId/quickreview/settings')
  updateSettings(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateReviewSettingsDto,
  ) {
    return this.reviewService.updateReviewSettings(user, locationId, dto);
  }

  @Get(':locationId/inbox')
  inbox(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.reviewService.listInbox(user, locationId);
  }
}
