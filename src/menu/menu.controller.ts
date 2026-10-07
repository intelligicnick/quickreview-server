import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  QuickCommerceSetupDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
  UpdateMenuSettingsDto,
} from './dto/menu.dto';
import type { UploadedImageFile } from '../scan/uploaded-file.type';
import { MenuService } from './menu.service';

@Controller('locations')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get(':locationId/quickmenu')
  hub(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.menu.merchantHub(user, locationId);
  }

  @Post(':locationId/quickmenu/setup')
  completeSetup(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: QuickCommerceSetupDto,
  ) {
    return this.menu.completeSetup(user, locationId, dto);
  }

  @Patch(':locationId/quickmenu')
  updateSettings(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: UpdateMenuSettingsDto,
  ) {
    return this.menu.updateSettings(user, locationId, dto);
  }

  @Post(':locationId/quickmenu/categories')
  createCategory(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.menu.createCategory(user, locationId, dto);
  }

  @Patch(':locationId/quickmenu/categories/:categoryId')
  updateCategory(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menu.updateCategory(user, locationId, categoryId, dto);
  }

  @Delete(':locationId/quickmenu/categories/:categoryId')
  deleteCategory(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
  ) {
    return this.menu.deleteCategory(user, locationId, categoryId);
  }

  @Post(':locationId/quickmenu/categories/:categoryId/items')
  createItem(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('categoryId', new ParseUUIDPipe({ version: '4' })) categoryId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menu.createItem(user, locationId, categoryId, dto);
  }

  @Patch(':locationId/quickmenu/items/:itemId')
  updateItem(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menu.updateItem(user, locationId, itemId, dto);
  }

  @Delete(':locationId/quickmenu/items/:itemId')
  deleteItem(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.menu.deleteItem(user, locationId, itemId);
  }

  @Post(':locationId/quickmenu/items/:itemId/photos/:slot')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadItemPhoto(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('slot', ParseIntPipe) slot: number,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('image file is required');
    }
    return this.menu.uploadItemPhoto(user, locationId, itemId, slot, file);
  }

  @Delete(':locationId/quickmenu/items/:itemId/photos/:slot')
  deleteItemPhoto(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Param('slot', ParseIntPipe) slot: number,
  ) {
    return this.menu.deleteItemPhoto(user, locationId, itemId, slot);
  }
}
