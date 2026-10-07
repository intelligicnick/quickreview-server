import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { QrCode } from '../platform/entities/qr-code.entity';
import { LocationRevisitSettings } from './location-revisit-settings.entity';
import { PublicRevisitController } from './public-revisit.controller';
import { RevisitController } from './revisit.controller';
import { RevisitCustomerReward } from './revisit-customer-reward.entity';
import { RevisitCustomer } from './revisit-customer.entity';
import { RevisitReward } from './revisit-reward.entity';
import { RevisitService } from './revisit.service';
import { RevisitVisit } from './revisit-visit.entity';

@Module({
  imports: [
    MembersModule,
    PlatformModule,
    TypeOrmModule.forFeature([
      Location,
      QrCode,
      LocationRevisitSettings,
      RevisitCustomer,
      RevisitVisit,
      RevisitReward,
      RevisitCustomerReward,
    ]),
  ],
  controllers: [PublicRevisitController, RevisitController],
  providers: [RevisitService],
  exports: [RevisitService],
})
export class RevisitModule {}
