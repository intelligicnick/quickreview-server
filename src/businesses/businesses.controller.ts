import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/create-business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.businessesService.listForUser(user);
  }

  @Get(':businessId')
  getOne(
    @CurrentUser() user: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
  ) {
    return this.businessesService.getOne(user, businessId);
  }

  @Patch(':businessId')
  update(
    @CurrentUser() user: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessesService.update(user, businessId, dto);
  }

  @Get(':businessId/members')
  members(
    @CurrentUser() user: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
  ) {
    return this.businessesService.listMembers(user, businessId);
  }
}
