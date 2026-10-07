import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AuthToken } from '../auth/auth-token.entity';
import { Business } from '../businesses/business.entity';
import { Location } from '../locations/location.entity';
import { BusinessMember } from '../members/business-member.entity';
import { User } from '../users/user.entity';
import { AdminEvent } from '../admin/admin-event.entity';
import { MenuCategoryPriceVariant } from '../menu/menu-category-price-variant.entity';
import { MenuCategory } from '../menu/menu-category.entity';
import { MenuItemVariantPrice } from '../menu/menu-item-variant-price.entity';
import { MenuItemPriceOption } from '../menu/menu-item-price-option.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { ConnectLead } from '../connect/connect-lead.entity';
import { ConnectLink } from '../connect/connect-link.entity';
import { ConnectProfile } from '../connect/connect-profile.entity';
import { UserGoogleConnection } from '../google/entities/user-google-connection.entity';
import { ReviewEvent } from '../review/review-event.entity';
import { LocationReviewSettings } from '../review/location-review-settings.entity';
import { DesignGeneration } from '../design/design-generation.entity';
import { DesignPoster } from '../design/design-poster.entity';
import { ScannedContact } from '../scan/scanned-contact.entity';
import { PLATFORM_ENTITIES } from '../platform/platform.module';
import { LocationRevisitSettings } from '../revisit/location-revisit-settings.entity';
import { RevisitCustomerReward } from '../revisit/revisit-customer-reward.entity';
import { RevisitCustomer } from '../revisit/revisit-customer.entity';
import { RevisitReward } from '../revisit/revisit-reward.entity';
import { RevisitVisit } from '../revisit/revisit-visit.entity';

export const ENTITIES = [
  User,
  AuthToken,
  Business,
  BusinessMember,
  Location,
  ConnectProfile,
  ConnectLink,
  ConnectLead,
  MenuCategory,
  MenuCategoryPriceVariant,
  MenuItemPriceOption,
  MenuItem,
  MenuItemVariantPrice,
  UserGoogleConnection,
  AdminEvent,
  ReviewEvent,
  LocationReviewSettings,
  DesignPoster,
  DesignGeneration,
  ScannedContact,
  LocationRevisitSettings,
  RevisitCustomer,
  RevisitVisit,
  RevisitReward,
  RevisitCustomerReward,
  ...PLATFORM_ENTITIES,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        const sync = config.get<string>('DATABASE_SYNC') === 'true';
        const migrationsRun = config.get<string>('DATABASE_MIGRATIONS_RUN') === 'true';
        const remoteSsl =
          /supabase\.(co|com)/i.test(url) || config.get<string>('DATABASE_SSL') === 'true';
        return {
          type: 'postgres',
          url,
          ...(remoteSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          entities: ENTITIES,
          synchronize: sync,
          migrations: [join(__dirname, 'migrations/*.{ts,js}')],
          migrationsRun: migrationsRun && !sync,
          logging: config.get<string>('NODE_ENV') === 'development' ? ['error'] : ['error'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
