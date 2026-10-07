import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import {
  UpdateRevisitRewardsDto,
  UpdateRevisitSettingsDto,
} from './dto/revisit-settings.dto';
import { RevisitService } from './revisit.service';

@Controller('locations')
export class RevisitController {
  constructor(private readonly revisit: RevisitService) {}

  @Get(':locationId/quickrevisit')
  summary(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.revisit.merchantSummary(user, locationId);
  }

  @Get(':locationId/quickrevisit/settings')
  settings(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.revisit.getSettings(user, locationId);
  }

  @Patch(':locationId/quickrevisit/settings')
  updateSettings(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateRevisitSettingsDto,
  ) {
    return this.revisit.updateSettings(user, locationId, dto);
  }

  @Patch(':locationId/quickrevisit/rewards')
  updateRewards(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateRevisitRewardsDto,
  ) {
    return this.revisit.updateRewards(user, locationId, dto);
  }

  @Get(':locationId/quickrevisit/customers')
  customers(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.revisit.listCustomers(user, locationId, {
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':locationId/quickrevisit/customers/:customerId')
  customerDetail(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
  ) {
    return this.revisit.customerDetail(user, locationId, customerId);
  }

  @Post(':locationId/quickrevisit/customer-rewards/:customerRewardId/redeem')
  redeem(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('customerRewardId', new ParseUUIDPipe({ version: '4' })) customerRewardId: string,
  ) {
    return this.revisit.redeemReward(user, locationId, customerRewardId);
  }
}
