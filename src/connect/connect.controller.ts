import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ConnectService } from './connect.service';
import { CreateConnectLinkDto, UpdateConnectLinkDto, UpdateConnectProfileDto } from './dto/connect.dto';

@Controller('locations')
export class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get(':locationId/quickconnect')
  hub(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.connect.merchantHub(user, locationId);
  }

  @Patch(':locationId/quickconnect')
  updateProfile(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateConnectProfileDto,
  ) {
    return this.connect.updateProfile(user, locationId, dto);
  }

  @Get(':locationId/quickconnect/leads')
  listLeads(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.connect.listLeads(user, locationId);
  }

  @Post(':locationId/quickconnect/links')
  addLink(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: CreateConnectLinkDto,
  ) {
    return this.connect.addLink(user, locationId, dto);
  }

  @Patch(':locationId/quickconnect/links/:linkId')
  updateLink(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('linkId', new ParseUUIDPipe({ version: '4' })) linkId: string,
    @Body() dto: UpdateConnectLinkDto,
  ) {
    return this.connect.updateLink(user, locationId, linkId, dto);
  }

  @Delete(':locationId/quickconnect/links/:linkId')
  deleteLink(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('linkId', new ParseUUIDPipe({ version: '4' })) linkId: string,
  ) {
    return this.connect.deleteLink(user, locationId, linkId);
  }
}
