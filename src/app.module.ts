import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ContactMessagesModule } from './contact/contact-messages.module';
import { ReviewModule } from './review/review.module';
import { PlatformModule } from './platform/platform.module';
import { AuthModule } from './auth/auth.module';
import { EmailVerifiedGuard } from './auth/guards/email-verified.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BusinessesModule } from './businesses/businesses.module';
import { DatabaseModule } from './database/database.module';
import { ConnectModule } from './connect/connect.module';
import { GoogleModule } from './google/google.module';
import { MenuModule } from './menu/menu.module';
import { DesignModule } from './design/design.module';
import { ScanModule } from './scan/scan.module';
import { RevisitModule } from './revisit/revisit.module';
import { HealthController } from './health/health.controller';
import { LocationsModule } from './locations/locations.module';
import { MailModule } from './mail/mail.module';
import { MembersModule } from './members/members.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 120 },
        { name: 'auth', ttl: 60_000, limit: 20 },
      ],
    }),
    DatabaseModule,
    MailModule,
    UsersModule,
    MembersModule,
    AuthModule,
    BusinessesModule,
    LocationsModule,
    GoogleModule,
    ConnectModule,
    MenuModule,
    PlatformModule,
    ContactMessagesModule,
    AdminModule,
    ReviewModule,
    DesignModule,
    ScanModule,
    RevisitModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
