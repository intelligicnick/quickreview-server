import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { DesignService } from './design.service';
import { GenerateDesignDto } from './dto/generate-design.dto';

@Controller('locations')
export class DesignController {
  constructor(private readonly design: DesignService) {}

  @Get(':locationId/quickdesign')
  hub(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.design.merchantHub(user, locationId);
  }

  @Post(':locationId/quickdesign/compose')
  compose(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: GenerateDesignDto,
  ) {
    return this.design.composePrompt(user, locationId, dto);
  }

  @Post(':locationId/quickdesign/generate')
  generate(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: GenerateDesignDto,
  ) {
    return this.design.generate(user, locationId, dto);
  }

  @Get(':locationId/quickdesign/posters/:posterId/image')
  @Header('Cache-Control', 'private, max-age=3600')
  async posterImage(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('posterId', new ParseUUIDPipe({ version: '4' })) posterId: string,
    @Res() res: Response,
  ) {
    const { mimeType, data } = await this.design.getPosterImage(user, locationId, posterId);
    res.setHeader('Content-Type', mimeType);
    res.send(data);
  }

  @Delete(':locationId/quickdesign/posters/:posterId')
  deletePoster(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('posterId', new ParseUUIDPipe({ version: '4' })) posterId: string,
  ) {
    return this.design.deletePoster(user, locationId, posterId);
  }
}
