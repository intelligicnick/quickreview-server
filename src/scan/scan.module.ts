import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { ScannedContact } from './scanned-contact.entity';
import { ScanController } from './scan.controller';
import { ScanOcrService } from './scan-ocr.service';
import { ScanService } from './scan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScannedContact, Location]),
    MembersModule,
    PlatformModule,
  ],
  controllers: [ScanController],
  providers: [ScanOcrService, ScanService],
})
export class ScanModule {}
