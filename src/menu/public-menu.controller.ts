import { Controller, Get, Header, Param, ParseIntPipe, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MenuService } from './menu.service';

@Controller('public/menu')
@Public()
export class PublicMenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('items/:itemId/photos/:slot')
  @Header('Cache-Control', 'public, max-age=86400')
  async itemPhoto(
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('slot', ParseIntPipe) slot: number,
    @Res() res: Response,
  ) {
    const photo = await this.menu.getItemPhoto(itemId, slot);
    if (!photo) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', photo.mimeType);
    res.send(photo.data);
  }

  @Get(':slug')
  getMenu(@Param('slug') slug: string) {
    return this.menu.getPublicMenu(slug);
  }
}
