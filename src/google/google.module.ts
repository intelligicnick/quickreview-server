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
import { GoogleOAuthService } from './google-oauth.service';
import { GooglePlacesService } from './google-places.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserGoogleConnection, Location]),
    BusinessesModule,
    MembersModule,
    ReviewModule,
  ],
  controllers: [GoogleController],
  providers: [
    GoogleOAuthService,
    GoogleBusinessService,
    GooglePlacesService,
    GoogleImportService,
  ],
  exports: [GooglePlacesService, GoogleImportService],
})
export class GoogleModule {}
