import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../users/user.entity';
import { ImportGoogleDto, PlacesSearchDto } from './dto/google.dto';
import { GoogleBusinessService } from './google-business.service';
import { GoogleImportService } from './google-import.service';
import { GoogleOAuthService } from './google-oauth.service';
import { GooglePlacesService } from './google-places.service';

@Controller('google')
export class GoogleController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly business: GoogleBusinessService,
    private readonly places: GooglePlacesService,
    private readonly importer: GoogleImportService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: User) {
    const connection = await this.oauth.getConnection(user.id);
    return {
      oauthConfigured: this.oauth.isConfigured(),
      placesConfigured: this.places.isConfigured(),
      connected: Boolean(connection),
      googleEmail: connection?.googleEmail ?? null,
    };
  }

  @Get('oauth/start')
  start(@CurrentUser() user: User) {
    return { url: this.oauth.buildAuthorizationUrl(user) };
  }

  @Public()
  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.oauth.handleCallback(code ?? '', state ?? '');
    const appUrl = (this.config.get<string>('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(`${appUrl}/app/businesses?google=connected`);
  }

  @Delete('connection')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: User) {
    await this.oauth.disconnect(user);
  }

  @Get('locations')
  async listManaged(@CurrentUser() user: User) {
    const connection = await this.oauth.getConnection(user.id);
    if (!connection) {
      return {
        source: 'gbp' as const,
        items: [],
        error: 'Connect Google Business Profile to list your managed locations.',
      };
    }
    try {
      const items = await this.business.listManagedLocations(user.id);
      return { source: 'gbp' as const, items };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load Google locations';
      return { source: 'gbp' as const, items: [], error: message };
    }
  }

  @Post('places/search')
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: PlacesSearchDto) {
    return this.places.searchText(dto.query);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  import(@CurrentUser() user: User, @Body() dto: ImportGoogleDto) {
    return this.importer.importFromGoogle(user, dto);
  }
}
