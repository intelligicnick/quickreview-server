import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { QrCodesService } from './qr-codes.service';

@Controller('public/q')
@Public()
export class PublicQrController {
  constructor(private readonly qr: QrCodesService) {}

  @Get(':code')
  resolve(@Param('code') code: string) {
    return this.qr.resolvePublic(code);
  }
}
