import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { geminiGenerateImage, geminiGenerateText, logGeminiFallback, mockPosterPng } from '../common/utils/gemini-client';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { LocationReviewSettings } from '../review/location-review-settings.entity';
import { User } from '../users/user.entity';
import {
  DESIGN_ASPECT_RATIO,
  DESIGN_ASPECT_RATIO_META,
  DESIGN_ASPECT_RATIOS,
  DESIGN_DAILY_LIMIT,
  DESIGN_LOOK_HINTS,
  DESIGN_MONTHLY_LIMIT,
  DESIGN_PICTURE_HINTS,
  type DesignAspectRatio,
  type DesignPictureMode,
  type DesignTemplate,
} from './design.constants';
import { DesignGeneration } from './design-generation.entity';
import { DesignPoster } from './design-poster.entity';
import { GenerateDesignDto } from './dto/generate-design.dto';
import { decodeImportedImageBase64 } from './perchance.utils';
import { PerchanceImageService } from './perchance-image.service';

export type DesignQuota = {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
};

export type DesignPosterDto = {
  id: string;
  locationId: string;
  template: DesignTemplate;
  pictureMode: DesignPictureMode;
  prompt: string | null;
  offerText: string | null;
  festival: string | null;
  aspectRatio: string;
  imageUrl: string;
  createdAt: Date;
};

function todayIst(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

@Injectable()
export class DesignService {
  constructor(
    private readonly config: ConfigService,
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
    @InjectRepository(DesignPoster) private readonly posters: Repository<DesignPoster>,
    @InjectRepository(DesignGeneration) private readonly generations: Repository<DesignGeneration>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(LocationReviewSettings)
    private readonly reviewSettings: Repository<LocationReviewSettings>,
    private readonly perchance: PerchanceImageService,
  ) {}

  async merchantHub(user: User, locationId: string) {
    const location = await this.assertManager(user, locationId);
    const [rows, quota, access] = await Promise.all([
      this.posters.find({
        where: { locationId },
        order: { createdAt: 'DESC' },
        take: 40,
        select: [
          'id',
          'locationId',
          'template',
          'pictureMode',
          'prompt',
          'offerText',
          'festival',
          'aspectRatio',
          'createdAt',
        ],
      }),
      this.getQuota(locationId),
      this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_DESIGN),
    ]);
    const apiBase = this.config.get<string>('API_PUBLIC_URL') ?? '';
    return {
      locationId,
      locationName: location.name,
      designUnlocked: access.unlocked,
      designAccess: access,
      posters: rows.map((row) => this.toDto(row, apiBase)),
      quota,
      options: {
        templates: ['sale', 'festival', 'cta', 'hours', 'new', 'custom'],
        looks: Object.keys(DESIGN_LOOK_HINTS),
        pictureModes: [
          { id: 'photos', label: 'Photos', hint: DESIGN_PICTURE_HINTS.photos },
          { id: 'design', label: 'Graphic design', hint: DESIGN_PICTURE_HINTS.design },
        ],
        aspectRatios: DESIGN_ASPECT_RATIOS.map((id) => ({
          id,
          label: DESIGN_ASPECT_RATIO_META[id].label,
          channel: DESIGN_ASPECT_RATIO_META[id].channel,
        })),
        imageProvider: this.imageProvider(),
        /** Server runs Perchance; clients never paste a user key. */
        perchanceReady: this.imageProvider() === 'perchance' && this.perchance.isConfigured(),
        perchanceUrl: 'https://perchance.org/ai-text-to-image-generator',
      },
    };
  }

  async composePrompt(user: User, locationId: string, dto: GenerateDesignDto) {
    const location = await this.assertManager(user, locationId);
    this.validateGenerateDto(dto);
    const keywords = await this.keywordsForLocation(locationId);
    const prompt = await this.composeImagePrompt(location, dto, keywords);
    return { prompt, aspectRatio: dto.aspectRatio ?? DESIGN_ASPECT_RATIO };
  }

  async generate(user: User, locationId: string, dto: GenerateDesignDto) {
    const location = await this.assertManager(user, locationId);
    const access = await this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_DESIGN);
    if (!access.unlocked) {
      throw new ForbiddenException('Activate QuickDesign on Subscription to generate posters');
    }
    this.validateGenerateDto(dto);
    await this.assertWithinQuota(locationId);

    const keywords = await this.keywordsForLocation(locationId);

    let imageBytes: Buffer;
    let mimeType: string;
    try {
      if (dto.importedImageBase64?.trim()) {
        const decoded = decodeImportedImageBase64(dto.importedImageBase64);
        imageBytes = decoded.bytes;
        mimeType = decoded.mimeType;
      } else {
        const imagePrompt = await this.composeImagePrompt(location, dto, keywords);
        const generated = await this.generateImage(imagePrompt, dto);
        imageBytes = generated.bytes;
        mimeType = generated.mimeType;
      }
    } catch (error) {
      await this.generations.save(
        this.generations.create({
          locationId,
          posterId: null,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }

    const poster = await this.posters.save(
      this.posters.create({
        locationId,
        template: dto.template,
        pictureMode: dto.picture ?? 'photos',
        prompt: dto.prompt?.trim() || null,
        offerText: dto.offerText?.trim() || null,
        festival: dto.festival?.trim() || null,
        mimeType,
        imageData: imageBytes,
        aspectRatio: dto.aspectRatio ?? DESIGN_ASPECT_RATIO,
      }),
    );

    await this.generations.save(
      this.generations.create({
        locationId,
        posterId: poster.id,
        status: 'success',
        error: null,
      }),
    );

    const apiBase = this.config.get<string>('API_PUBLIC_URL') ?? '';
    return {
      poster: this.toDto(poster, apiBase),
      quota: await this.getQuota(locationId),
    };
  }

  async getPosterImage(user: User, locationId: string, posterId: string) {
    await this.assertManager(user, locationId);
    const poster = await this.posters.findOne({
      where: { id: posterId, locationId },
      select: ['mimeType', 'imageData'],
    });
    if (!poster) {
      throw new NotFoundException('Poster not found');
    }
    return { mimeType: poster.mimeType, data: poster.imageData };
  }

  async deletePoster(user: User, locationId: string, posterId: string) {
    await this.assertManager(user, locationId);
    const poster = await this.posters.findOne({ where: { id: posterId, locationId } });
    if (!poster) {
      throw new NotFoundException('Poster not found');
    }
    await this.posters.delete({ id: poster.id });
  }

  private validateGenerateDto(dto: GenerateDesignDto): void {
    if (dto.template === 'custom' && !dto.prompt?.trim()) {
      throw new HttpException('Write a short prompt for a custom poster.', HttpStatus.BAD_REQUEST);
    }
    if (dto.template === 'festival' && !dto.festival?.trim()) {
      throw new HttpException('Choose a festival or occasion.', HttpStatus.BAD_REQUEST);
    }
  }

  private async assertWithinQuota(locationId: string): Promise<void> {
    const quota = await this.getQuota(locationId);
    if (quota.monthlyUsed >= quota.monthlyLimit) {
      throw new HttpException(
        `Monthly QuickDesign limit reached (${quota.monthlyLimit} posters).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async getQuota(locationId: string): Promise<DesignQuota> {
    const today = todayIst();
    const monthStart = `${today.slice(0, 7)}-01`;
    const startOfToday = new Date(`${today}T00:00:00+05:30`);
    const startOfMonth = new Date(`${monthStart}T00:00:00+05:30`);

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.generations.count({
        where: { locationId, createdAt: MoreThanOrEqual(startOfToday) },
      }),
      this.generations.count({
        where: { locationId, createdAt: MoreThanOrEqual(startOfMonth) },
      }),
    ]);

    return {
      dailyUsed,
      dailyLimit: DESIGN_DAILY_LIMIT,
      monthlyUsed,
      monthlyLimit: DESIGN_MONTHLY_LIMIT,
    };
  }

  private resolveBrand(
    location: Location,
    dto: GenerateDesignDto,
  ): { name: string | null; phone: string | null } {
    const includeName = dto.includeBusinessName !== false;
    const includePhone = dto.includePhone !== false;
    return {
      name: includeName ? dto.businessName?.trim() || location.name : null,
      phone: includePhone ? dto.phoneNumber?.trim() || location.phone || null : null,
    };
  }

  private brandInstructions(location: Location, dto: GenerateDesignDto): string {
    const brand = this.resolveBrand(location, dto);
    return [
      brand.name
        ? `Write the shop name exactly as "${brand.name}" in the poster, designed into the layout.`
        : 'Do not write a business name.',
      brand.phone
        ? `Write the phone number exactly as "${brand.phone}". Spell every digit correctly.`
        : 'Do not write or invent a phone number.',
      'Do not invent a different business name or number.',
    ].join(' ');
  }

  private imageProvider(): 'perchance' | 'gemini' {
    const raw = this.config.get<string>('QUICKDESIGN_IMAGE_PROVIDER')?.trim().toLowerCase();
    return raw === 'gemini' ? 'gemini' : 'perchance';
  }

  private fallbackPrompt(location: Location, dto: GenerateDesignDto, keywords: string[]): string {
    const picture = dto.picture ?? 'photos';
    const brand = this.resolveBrand(location, dto);
    const ratio = dto.aspectRatio ?? DESIGN_ASPECT_RATIO;
    const backgroundOnly =
      this.imageProvider() === 'perchance' && this.perchance.isConfigured();
    if (backgroundOnly) {
      return [
        `${ratio} photorealistic background for ${location.name}`,
        dto.festival ? `${dto.festival} festive atmosphere` : '',
        dto.offerText ? `mood inspired by: ${dto.offerText}` : '',
        dto.prompt ? `Direction: ${dto.prompt}` : '',
        dto.look ? DESIGN_LOOK_HINTS[dto.look] : '',
        DESIGN_PICTURE_HINTS[picture],
        keywords.length ? `Visual cues: ${keywords.slice(0, 6).join(', ')}` : '',
        'no text, no letters, no numbers, no logos, empty space for typography overlay',
      ]
        .filter(Boolean)
        .join('. ');
    }
    return [
      `${ratio} promotional poster for ${location.name}`,
      dto.festival ? `for ${dto.festival}` : '',
      dto.offerText ? `featuring "${dto.offerText}"` : '',
      dto.prompt ? `Direction: ${dto.prompt}` : '',
      dto.look ? DESIGN_LOOK_HINTS[dto.look] : '',
      DESIGN_PICTURE_HINTS[picture],
      keywords.length ? `Visual cues: ${keywords.slice(0, 6).join(', ')}` : '',
      brand.name ? `Shop name: ${brand.name}` : '',
      brand.phone ? `Phone: ${brand.phone}` : '',
    ]
      .filter(Boolean)
      .join('. ');
  }

  private async composeImagePrompt(
    location: Location,
    dto: GenerateDesignDto,
    keywords: string[],
  ): Promise<string> {
    const picture = dto.picture ?? 'photos';
    const brand = this.resolveBrand(location, dto);
    const details = [
      brand.name ? `Business name: ${brand.name}` : 'Do not include a business name',
      location.address ? `Address hint: ${location.address}` : null,
      brand.phone ? `Phone: ${brand.phone}` : 'Do not include a phone number',
      keywords.length ? `Keywords: ${keywords.join(', ')}` : null,
      `Template: ${dto.template}`,
      dto.look ? `Mood: ${dto.look}. ${DESIGN_LOOK_HINTS[dto.look]}` : null,
      `Picture mode: ${picture}. ${DESIGN_PICTURE_HINTS[picture]}`,
      dto.festival ? `Festival / occasion: ${dto.festival}` : null,
      dto.offerText ? `Offer text to feature: ${dto.offerText}` : null,
      dto.prompt ? `Owner request: ${dto.prompt}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');

    const ratio = dto.aspectRatio ?? DESIGN_ASPECT_RATIO;
    const backgroundOnly =
      this.imageProvider() === 'perchance' && this.perchance.isConfigured();
    const instructions = backgroundOnly
      ? [
          `You write a single image-generation prompt for a ${ratio} background plate for an Indian small business social poster.`,
          'Return ONLY the image prompt. No title, no markdown, no quotes.',
          'The app adds all typography later (festival name, discount, shop name, phone).',
          'CRITICAL: No text, letters, numbers, logos, watermarks, or UI chrome in the image.',
          'Invent an original visual within the picture mode — leave clear space for text overlays.',
          'Do not write business names or phone numbers in the image.',
          '',
          details,
        ].join('\n')
      : [
          `You write a single image-generation prompt for a ${ratio} social poster for an Indian small business.`,
          'Return ONLY the image prompt. No title, no markdown, no quotes.',
          'Invent an original layout within the picture mode.',
          this.brandInstructions(location, dto),
          'English or simple Hinglish text only. No QR codes, no fake awards.',
          '',
          details,
        ].join('\n');

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'mock') {
      return this.fallbackPrompt(location, dto, keywords);
    }

    const composeModel = this.config.get<string>('GEMINI_COMPOSE_MODEL') ?? 'gemini-2.0-flash';
    try {
      const text = await geminiGenerateText(apiKey, composeModel, instructions);
      if (text) return text;
    } catch (err) {
      logGeminiFallback(err, 'Design compose');
    }
    return this.fallbackPrompt(location, dto, keywords);
  }

  private async generateImage(
    prompt: string,
    dto: GenerateDesignDto,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    const aspect = (dto.aspectRatio ?? DESIGN_ASPECT_RATIO) as DesignAspectRatio;

    if (this.imageProvider() === 'perchance' && this.perchance.isConfigured()) {
      try {
        return await this.perchance.generate(prompt, aspect);
      } catch (err) {
        logGeminiFallback(err, 'Perchance design image');
      }
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'mock') {
      const label = `${dto.template} · ${dto.picture ?? 'photos'}`;
      return { bytes: mockPosterPng(label, aspect), mimeType: 'image/svg+xml' };
    }

    const imageModel =
      this.config.get<string>('GEMINI_IMAGE_MODEL') ?? 'gemini-2.0-flash-preview-image-generation';
    try {
      return await geminiGenerateImage(apiKey, imageModel, prompt, aspect);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      throw new BadGatewayException(`Failed to generate poster: ${message}`);
    }
  }

  private async keywordsForLocation(locationId: string): Promise<string[]> {
    const row = await this.reviewSettings.findOne({ where: { locationId } });
    return row?.keywords ?? [];
  }

  private async assertManager(user: User, locationId: string): Promise<Location> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);
    return location;
  }

  private toDto(row: DesignPoster, apiBase: string): DesignPosterDto {
    const path = `/api/locations/${row.locationId}/quickdesign/posters/${row.id}/image`;
    return {
      id: row.id,
      locationId: row.locationId,
      template: row.template,
      pictureMode: row.pictureMode,
      prompt: row.prompt,
      offerText: row.offerText,
      festival: row.festival,
      aspectRatio: row.aspectRatio,
      imageUrl: apiBase ? `${apiBase.replace(/\/$/, '')}${path}` : path,
      createdAt: row.createdAt,
    };
  }
}
