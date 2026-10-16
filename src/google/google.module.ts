import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessesModule } from '../businesses/businesses.module';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { ReviewModule } from '../review/review.module';
import { UserGoogleConnection } from './entities/user-google-connection.entity';
import { GoogleBusinessService } from './google-business.service';
import { GoogleController } from './google.controller';
import { GoogleImportService } from './google-import.service';
import { GoogleLocationFromPlaceService } from './google-location-from-place.service';
import { GoogleOAuthService } from './google-oauth.service';
import { GooglePlacesModule } from './google-places.module';
import { GoogleReviewGrowthModule } from './google-review-growth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserGoogleConnection, Location]),
    BusinessesModule,
    MembersModule,
    ReviewModule,
    GooglePlacesModule,
    GoogleReviewGrowthModule,
  ],
  controllers: [GoogleController],
  providers: [GoogleOAuthService, GoogleBusinessService, GoogleImportService, GoogleLocationFromPlaceService],
  exports: [GooglePlacesModule, GoogleImportService, GoogleReviewGrowthModule, GoogleLocationFromPlaceService],
})
export class GoogleModule {}
