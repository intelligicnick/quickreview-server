import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { Business } from '../businesses/business.entity';
import { BusinessesModule } from '../businesses/businesses.module';
import { GoogleModule } from '../google/google.module';
import { Location } from '../locations/location.entity';
import { Plan } from '../platform/entities/plan.entity';
import { QrCode } from '../platform/entities/qr-code.entity';
import { PlatformModule } from '../platform/platform.module';
import { UsersModule } from '../users/users.module';
import { CounterSaleAgent } from './counter-sale-agent.entity';
import { CounterSaleAgentsService } from './counter-sale-agents.service';
import { CounterSaleAuthService } from './counter-sale-auth.service';
import { CounterSaleController } from './counter-sale.controller';
import { CounterSaleHoldingBootstrap } from './counter-sale-holding.bootstrap';
import { CounterSaleHoldingService } from './counter-sale-holding.service';
import { CounterSaleProvision } from './counter-sale-provision.entity';
import { CounterSaleProvisionService } from './counter-sale-provision.service';
import { CounterSaleProvisionerGuard } from './guards/counter-sale-provisioner.guard';

@Module({
  imports: [
    UsersModule,
    BusinessesModule,
    GoogleModule,
    PlatformModule,
    forwardRef(() => AdminModule),
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      CounterSaleAgent,
      CounterSaleProvision,
      QrCode,
      Plan,
      Location,
      Business,
    ]),
  ],
  controllers: [CounterSaleController],
  providers: [
    CounterSaleAuthService,
    CounterSaleProvisionService,
    CounterSaleAgentsService,
    CounterSaleHoldingService,
    CounterSaleHoldingBootstrap,
    CounterSaleProvisionerGuard,
  ],
  exports: [CounterSaleAgentsService, CounterSaleAuthService],
})
export class CounterSaleModule {}
