import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { GooglePlacesModule } from './google-places.module';
import { GoogleReviewGrowthService } from './google-review-growth.service';
import { LocationGoogleReviewSnapshot } from './location-google-review-snapshot.entity';

@Module({
  imports: [
    GooglePlacesModule,
    MembersModule,
    TypeOrmModule.forFeature([Location, LocationGoogleReviewSnapshot]),
  ],
  providers: [GoogleReviewGrowthService],
  exports: [GoogleReviewGrowthService],
})
export class GoogleReviewGrowthModule {}
