import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembersModule } from '../members/members.module';
import { BillingController } from './billing.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PublicQrController } from './public-qr.controller';
import { QrCodesController } from './qr-codes.controller';
import { QrCodesService } from './qr-codes.service';
import { ContactMessage } from './entities/contact-message.entity';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { Payment } from './entities/payment.entity';
import { Plan } from './entities/plan.entity';
import { QrCode } from './entities/qr-code.entity';
import { MarketplaceCategory } from './entities/marketplace-category.entity';
import { QrProduct } from './entities/qr-product.entity';
import { Subscription } from './entities/subscription.entity';
import { Location } from '../locations/location.entity';
import { PlatformBootstrap } from './platform.bootstrap';
import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { SubscriptionsService } from './subscriptions.service';

export const PLATFORM_ENTITIES = [
  Plan,
  Subscription,
  Payment,
  MarketplaceCategory,
  QrProduct,
  MarketplaceOrder,
  QrCode,
  ContactMessage,
];

@Module({
  imports: [
    MembersModule,
    TypeOrmModule.forFeature([...PLATFORM_ENTITIES, Location]),
  ],
  controllers: [
    BillingController,
    MarketplaceController,
    PublicQrController,
    QrCodesController,
    RazorpayWebhookController,
  ],
  providers: [
    PlatformBootstrap,
    SubscriptionsService,
    MarketplaceService,
    QrCodesService,
    RazorpayService,
  ],
  exports: [TypeOrmModule, SubscriptionsService, MarketplaceService, QrCodesService, RazorpayService],
})
export class PlatformModule {}
