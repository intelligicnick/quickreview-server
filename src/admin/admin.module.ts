import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Business } from '../businesses/business.entity';
import { Location } from '../locations/location.entity';
import { BusinessMember } from '../members/business-member.entity';
import { MembersModule } from '../members/members.module';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { AdminBootstrap } from './admin.bootstrap';
import { AdminController } from './admin.controller';
import { PlatformModule } from '../platform/platform.module';
import { ReviewEvent } from '../review/review-event.entity';
import { AdminEvent } from './admin-event.entity';
import { AdminPlatformService } from './admin-platform.service';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [
    UsersModule,
    MembersModule,
    AuthModule,
    PlatformModule,
    TypeOrmModule.forFeature([User, Business, Location, BusinessMember, AdminEvent, ReviewEvent]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminPlatformService, AdminBootstrap, SuperAdminGuard],
})
export class AdminModule {}
