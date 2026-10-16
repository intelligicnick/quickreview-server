import { Module } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';

@Module({
  providers: [GooglePlacesService],
  exports: [GooglePlacesService],
})
export class GooglePlacesModule {}
