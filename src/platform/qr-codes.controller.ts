import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ClaimQrCodeDto } from './dto/qr.dto';
import { QrCodesService } from './qr-codes.service';

@Controller('locations')
export class QrCodesController {
  constructor(private readonly qr: QrCodesService) {}

  @Get(':locationId/qr-codes')
  list(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.qr.listForLocation(user, locationId);
  }

  @Post(':locationId/qr-codes/claim')
  claim(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: ClaimQrCodeDto,
  ) {
    return this.qr.claimForLocation(user, locationId, dto.code, dto.kind);
  }
}
