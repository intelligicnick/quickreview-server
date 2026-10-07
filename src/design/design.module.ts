import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { LocationReviewSettings } from '../review/location-review-settings.entity';
import { DesignGeneration } from './design-generation.entity';
import { DesignPoster } from './design-poster.entity';
import { DesignController } from './design.controller';
import { DesignService } from './design.service';
import { PerchanceImageService } from './perchance-image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesignPoster, DesignGeneration, Location, LocationReviewSettings]),
    MembersModule,
    PlatformModule,
  ],
  controllers: [DesignController],
  providers: [DesignService, PerchanceImageService],
})
export class DesignModule {}
