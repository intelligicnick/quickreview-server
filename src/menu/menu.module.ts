import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/location.entity';
import { MembersModule } from '../members/members.module';
import { PlatformModule } from '../platform/platform.module';
import { MenuCategoryPriceVariant } from './menu-category-price-variant.entity';
import { MenuCategory } from './menu-category.entity';
import { MenuItemPriceOption } from './menu-item-price-option.entity';
import { MenuItemVariantPrice } from './menu-item-variant-price.entity';
import { MenuItem } from './menu-item.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PublicCommerceHubController } from './public-commerce-hub.controller';
import { PublicMenuController } from './public-menu.controller';
import { LocationRevisitSettings } from '../revisit/location-revisit-settings.entity';

@Module({
  imports: [
    MembersModule,
    PlatformModule,
    TypeOrmModule.forFeature([
      MenuCategory,
      MenuCategoryPriceVariant,
      MenuItem,
      MenuItemVariantPrice,
      MenuItemPriceOption,
      Location,
      LocationRevisitSettings,
    ]),
  ],
  controllers: [MenuController, PublicMenuController, PublicCommerceHubController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
