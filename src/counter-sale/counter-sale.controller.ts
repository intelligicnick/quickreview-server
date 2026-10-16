import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { GooglePlacesService } from '../google/google-places.service';
import { CounterSaleAuthService } from './counter-sale-auth.service';
import { CounterSaleProvisionService } from './counter-sale-provision.service';
import { CounterSaleProvisioner } from './decorators/counter-sale-provisioner.decorator';
import {
  CounterSaleLoginDto,
  CounterSalePlacesQueryDto,
  CounterSaleProvisionDto,
  CounterSaleQrLookupQueryDto,
} from './dto/counter-sale.dto';
import { CounterSaleProvisionerGuard } from './guards/counter-sale-provisioner.guard';

@Controller('counter-sale')
export class CounterSaleController {
  constructor(
    private readonly auth: CounterSaleAuthService,
    private readonly provision: CounterSaleProvisionService,
    private readonly places: GooglePlacesService,
  ) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: CounterSaleLoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @UseGuards(CounterSaleProvisionerGuard)
  @Get('places/search')
  searchPlaces(@Query() query: CounterSalePlacesQueryDto) {
    return this.places.searchText(query.q);
  }

  @Public()
  @UseGuards(CounterSaleProvisionerGuard)
  @Get('qr-codes/lookup')
  lookupQr(@Query() query: CounterSaleQrLookupQueryDto) {
    return this.provision.lookupQr(query.code);
  }

  @Public()
  @UseGuards(CounterSaleProvisionerGuard)
  @Post('provisions')
  createProvision(
    @CounterSaleProvisioner() actor: Parameters<CounterSaleProvisionService['provision']>[0],
    @Body() dto: CounterSaleProvisionDto,
  ) {
    return this.provision.provision(actor, dto);
  }
}
