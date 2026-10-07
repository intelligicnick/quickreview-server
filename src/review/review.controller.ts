import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { UpdateReviewSettingsDto } from './dto/review-settings.dto';
import { ReviewService } from './review.service';

@Controller('locations')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get(':locationId/quickreview')
  summary(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.reviewService.merchantSummary(user, locationId);
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
