import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { RevisitCheckInDto } from './dto/public-revisit.dto';
import { RevisitService } from './revisit.service';

@Controller('public/quick-revisit')
@Public()
export class PublicRevisitController {
  constructor(private readonly revisit: RevisitService) {}

  @Get(':code')
  getPage(@Param('code') code: string) {
    return this.revisit.getPublicPage(code);
  }

  @Post(':code/check-in')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  checkIn(@Param('code') code: string, @Body() dto: RevisitCheckInDto) {
    return this.revisit.checkIn(code, dto);
  }
}
