import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { LocationsService } from './locations.service';

@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post('businesses/:businessId/locations')
  create(
    @CurrentUser() user: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locationsService.create(user, businessId, dto);
  }

  @Get('businesses/:businessId/locations')
  list(
    @CurrentUser() user: User,
    @Param('businessId', new ParseUUIDPipe({ version: '4' })) businessId: string,
  ) {
    return this.locationsService.list(user, businessId);
  }

  @Get('locations/:locationId')
  getOne(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.locationsService.getOne(user, locationId);
  }

  @Patch('locations/:locationId')
  update(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(user, locationId, dto);
  }
}
