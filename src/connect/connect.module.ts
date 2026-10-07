import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { ConnectLead } from './connect-lead.entity';
import { ConnectLink } from './connect-link.entity';
import { ConnectProfile } from './connect-profile.entity';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';
import { PublicConnectController } from './public-connect.controller';

@Module({
  imports: [
    MembersModule,
    PlatformModule,
    TypeOrmModule.forFeature([ConnectProfile, ConnectLink, ConnectLead, Location]),
  ],
  controllers: [ConnectController, PublicConnectController],
  providers: [ConnectService],
  exports: [ConnectService],
})
export class ConnectModule {}
