import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { PlaceMarketplaceOrderDto } from './dto/marketplace.dto';
import { MarketplaceService } from './marketplace.service';

@Controller('locations')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get(':locationId/marketplace')
  hub(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.marketplace.merchantHub(user, locationId);
  }

  @Post(':locationId/marketplace/orders')
  placeOrder(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: PlaceMarketplaceOrderDto,
  ) {
    return this.marketplace.placeOrder(user, locationId, dto);
  }
}
