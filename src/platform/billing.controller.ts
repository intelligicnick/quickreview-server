import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { StartCheckoutDto } from './dto/billing.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  listPlans() {
    return this.subscriptions.listActivePlans();
  }

  @Get('locations/:locationId')
  locationBilling(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.subscriptions.getLocationBilling(user, locationId);
  }

  @Post('locations/:locationId/checkout')
  checkout(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: StartCheckoutDto,
  ) {
    return this.subscriptions.startCheckout(user, locationId, dto.planId, dto.provider);
  }
}
