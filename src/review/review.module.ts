import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { LocationReviewSettings } from './location-review-settings.entity';
import { PublicReviewController } from './public-review.controller';
import { ReviewBootstrap } from './review.bootstrap';
import { ReviewController } from './review.controller';
import { ReviewDraftService } from './review-draft.service';
import { ReviewEvent } from './review-event.entity';
import { ReviewService } from './review.service';

@Module({
  imports: [MembersModule, PlatformModule, TypeOrmModule.forFeature([Location, ReviewEvent, LocationReviewSettings])],
  controllers: [PublicReviewController, ReviewController],
  providers: [ReviewService, ReviewBootstrap, ReviewDraftService],
  exports: [ReviewService],
})
export class ReviewModule {}
