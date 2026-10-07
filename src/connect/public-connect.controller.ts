import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ConnectService } from './connect.service';
import { CreateConnectLeadDto } from './dto/connect.dto';

@Controller('public/c')
@Public()
export class PublicConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get(':slug')
  getCard(@Param('slug') slug: string) {
    return this.connect.getPublicCard(slug);
  }

  @Post(':slug/leads')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  submitLead(@Param('slug') slug: string, @Body() dto: CreateConnectLeadDto) {
    return this.connect.submitLead(slug, dto);
  }
}
