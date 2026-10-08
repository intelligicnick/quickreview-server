import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AdminModule } from '../src/admin/admin.module';
import { ContactMessagesModule } from '../src/contact/contact-messages.module';
import { PlatformModule } from '../src/platform/platform.module';
import { ConnectModule } from '../src/connect/connect.module';
import { MenuModule } from '../src/menu/menu.module';
import { ReviewModule } from '../src/review/review.module';
import { AuthModule } from '../src/auth/auth.module';
import { EmailVerifiedGuard } from '../src/auth/guards/email-verified.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { BusinessesModule } from '../src/businesses/businesses.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { ENTITIES } from '../src/database/database.module';
import { GoogleModule } from '../src/google/google.module';
import { HealthController } from '../src/health/health.controller';
import { LocationsModule } from '../src/locations/locations.module';
import { MailModule } from '../src/mail/mail.module';
import { MailService } from '../src/mail/mail.service';
import { MembersModule } from '../src/members/members.module';
import { UsersModule } from '../src/users/users.module';
import { MemoryMailService } from './memory-mail.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  mail: MemoryMailService;
}> {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-please-change';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-please-change';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.EMAIL_MODE = 'log';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? 'mock';

  const mail = new MemoryMailService();

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: ENTITIES,
        synchronize: true,
        dropSchema: true,
      }),
      MailModule,
      UsersModule,
      MembersModule,
      AuthModule,
      BusinessesModule,
      LocationsModule,
      GoogleModule,
      PlatformModule,
      ContactMessagesModule,
      AdminModule,
      ReviewModule,
      ConnectModule,
      MenuModule,
    ],
    controllers: [HealthController],
    providers: [
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    ],
  })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();

  const app = module.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();

  return { app, mail };
}
