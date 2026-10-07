import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import type { ScanCaptureMode } from './scanned-contact.entity';
import { UpdateScannedContactDto } from './dto/update-scanned-contact.dto';
import { ScanService } from './scan.service';
import type { UploadedImageFile } from './uploaded-file.type';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

@Controller('locations')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  @Get(':locationId/quickscan')
  hub(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
  ) {
    return this.scan.merchantHub(user, locationId);
  }

  @Post(':locationId/quickscan/scan')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  scanCard(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Body('mode') modeRaw: string,
    @UploadedFiles()
    files: { front?: UploadedImageFile[]; back?: UploadedImageFile[] },
  ) {
    const mode = modeRaw as ScanCaptureMode;
    if (mode !== 'front' && mode !== 'back' && mode !== 'both') {
      throw new BadRequestException('mode must be front, back, or both');
    }
    return this.scan.scanCard(user, locationId, mode, files.front?.[0], files.back?.[0]);
  }

  @Patch(':locationId/quickscan/contacts/:contactId')
  updateContact(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
    @Body() body: UpdateScannedContactDto,
  ) {
    return this.scan.updateContact(user, locationId, contactId, body);
  }

  @Get(':locationId/quickscan/contacts/:contactId/vcard')
  @Header('Content-Type', 'text/vcard; charset=utf-8')
  vcard(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
  ) {
    return this.scan.getVcard(user, locationId, contactId);
  }

  @Delete(':locationId/quickscan/contacts/:contactId')
  deleteContact(
    @CurrentUser() user: User,
    @Param('locationId', new ParseUUIDPipe({ version: '4' })) locationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
  ) {
    return this.scan.deleteContact(user, locationId, contactId);
  }
}
