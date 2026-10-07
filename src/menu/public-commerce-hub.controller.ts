import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MenuService } from './menu.service';

@Controller('public/go')
@Public()
export class PublicCommerceHubController {
  constructor(private readonly menu: MenuService) {}

  @Get(':slug')
  getHub(@Param('slug') slug: string) {
    return this.menu.getPublicHub(slug);
  }
}
