import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { User } from '../users/user.entity';
import {
  BUSINESS_CATEGORY_CARDS,
  businessCategoryFromMenuMode,
  catalogCopyForLocation,
  catalogTypeForCategory,
  defaultPriceVariantNames,
  menuImagePlaceholder,
  menuModeForCategory,
  usesCategoryPriceVariants,
  catalogGuestBrowse,
} from '../catalog/catalog-config';
import { BusinessCategory } from '../catalog/business-category.enum';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  QuickCommerceSetupDto,
  UpdateMenuCategoryDto,
  MenuCategoryPriceVariantDto,
  MenuItemPriceOptionDto,
  MenuItemVariantPriceDto,
  UpdateMenuItemDto,
  UpdateMenuSettingsDto,
} from './dto/menu.dto';
import { MenuCategoryPriceVariant } from './menu-category-price-variant.entity';
import { MenuCategory } from './menu-category.entity';
import { MenuItemPriceOption } from './menu-item-price-option.entity';
import { MenuItemVariantPrice } from './menu-item-variant-price.entity';
import { MenuItem } from './menu-item.entity';
import { itemPricingFields, minVariantPrice } from './menu-pricing.util';
import {
  deleteMenuPhoto,
  MENU_PHOTO_SLOTS,
  normalizeStoredImageUrls,
  readMenuPhoto,
  resolveMenuImageUrls,
  saveMenuPhoto,
} from './menu-photo.storage';
import { LocationRevisitSettings } from '../revisit/location-revisit-settings.entity';
import { revisitPublicPath } from '../revisit/revisit.util';
import {
  commerceHubPublicFullUrl,
  commerceHubPublicPath,
  menuPublicPath,
  slugifyMenuSlug,
} from './menu.util';
import type { UploadedImageFile } from '../scan/uploaded-file.type';

@Injectable()
export class MenuService {
  constructor(
    private readonly config: ConfigService,
    private readonly members: MembersService,
    private readonly subscriptions: SubscriptionsService,
    @InjectRepository(MenuCategory) private readonly categories: Repository<MenuCategory>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(MenuCategoryPriceVariant)
    private readonly categoryVariants: Repository<MenuCategoryPriceVariant>,
    @InjectRepository(MenuItemVariantPrice)
    private readonly itemVariantPrices: Repository<MenuItemVariantPrice>,
    @InjectRepository(MenuItemPriceOption)
    private readonly itemPriceOptions: Repository<MenuItemPriceOption>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(LocationRevisitSettings)
    private readonly revisitSettings: Repository<LocationRevisitSettings>,
  ) {}

  async merchantHub(user: User, locationId: string) {
    const location = await this.getLocationForMember(user, locationId);
    await this.ensureLegacyQuickCommerceSetup(location);
    const slug = await this.ensureLocationSlug(location);
    const [menuAccess, categories] = await Promise.all([
      this.subscriptions.getProductAccess(locationId, BillingProduct.QUICK_MENU),
      this.loadCategories(locationId),
    ]);
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
    const copy = catalogCopyForLocation(location.businessCategory, location.menuMode);
    const priceVariantScope = usesCategoryPriceVariants(location.businessCategory, location.menuMode)
      ? 'category'
      : 'product';
    return {
      locationId,
      locationName: location.name,
      slug,
      menuMode: location.menuMode,
      businessCategory: location.businessCategory,
      businessSubcategories: location.businessSubcategories ?? [],
      catalogType: location.catalogType,
      needsOnboarding: !location.quickCommerceSetupAt,
      onboardingOptions: BUSINESS_CATEGORY_CARDS,
      copy: {
        ...copy,
        guestBrowse: catalogGuestBrowse(copy.presentation),
      },
      priceVariantScope,
      publicPath: commerceHubPublicPath(slug),
      publicUrl: commerceHubPublicFullUrl(appUrl, slug),
      menuUnlocked: menuAccess.unlocked,
      menuAccess,
      imagePlaceholder: menuImagePlaceholder(location.businessCategory, location.menuMode),
      categories,
    };
  }

  async uploadItemPhoto(
    user: User,
    locationId: string,
    itemId: string,
    slot: number,
    file: UploadedImageFile,
  ) {
    await this.assertManager(user, locationId);
    if (slot < 0 || slot >= MENU_PHOTO_SLOTS) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Photo slot must be 0 or 1',
      });
    }
    const item = await this.items.findOne({ where: { id: itemId, locationId } });
    if (!item) throw this.notFound('Item not found');
    try {
      await saveMenuPhoto(item.id, slot, file.buffer, file.mimetype);
    } catch (err) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: err instanceof Error ? err.message : 'Could not save image',
      });
    }
    item.imageUrls = this.mergePhotoSlot(
      normalizeStoredImageUrls(item.imageUrls, item.imageUrl),
      slot,
    );
    item.imageUrl = null;
    await this.items.save(item);
    return this.serializeItemResponse(item, locationId);
  }

  async deleteItemPhoto(user: User, locationId: string, itemId: string, slot: number) {
    await this.assertManager(user, locationId);
    if (slot < 0 || slot >= MENU_PHOTO_SLOTS) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Photo slot must be 0 or 1',
      });
    }
    const item = await this.items.findOne({ where: { id: itemId, locationId } });
    if (!item) throw this.notFound('Item not found');
    await deleteMenuPhoto(item.id, slot);
    const marker = slot === 1 ? 'local:1' : 'local:0';
    item.imageUrls = normalizeStoredImageUrls(item.imageUrls, item.imageUrl).filter((row) => row !== marker);
    if (!item.imageUrls.length) item.imageUrl = null;
    await this.items.save(item);
    return this.serializeItemResponse(item, locationId);
  }

  async getItemPhoto(itemId: string, slot: number): Promise<{ data: Buffer; mimeType: string } | null> {
    if (slot < 0 || slot >= MENU_PHOTO_SLOTS) return null;
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) return null;
    const stored = normalizeStoredImageUrls(item.imageUrls, item.imageUrl);
    const marker = slot === 1 ? 'local:1' : 'local:0';
    if (!stored.includes(marker)) return null;
    const data = await readMenuPhoto(itemId, slot);
    if (!data) return null;
    return { data, mimeType: 'image/webp' };
  }

  async completeSetup(user: User, locationId: string, dto: QuickCommerceSetupDto) {
    await this.assertManager(user, locationId);
    const location = await this.getLocationForMember(user, locationId);
    const primary = dto.businessCategory;
    const extra = (dto.businessSubcategories ?? []).filter((row) => row !== primary);
    location.businessCategory = primary;
    location.businessSubcategories = extra;
    location.catalogType = catalogTypeForCategory(primary);
    location.menuMode = menuModeForCategory(primary);
    location.quickCommerceSetupAt = new Date();
    await this.locations.save(location);
    return this.merchantHub(user, locationId);
  }

  async updateSettings(user: User, locationId: string, dto: UpdateMenuSettingsDto) {
    await this.assertManager(user, locationId);
    const location = await this.getLocationForMember(user, locationId);
    if (dto.menuMode !== undefined) location.menuMode = dto.menuMode;
    if (dto.slug !== undefined) {
      const normalized = slugifyMenuSlug(dto.slug.trim());
      if (!normalized) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Slug must contain letters or numbers',
        });
      }
      location.slug = await this.uniqueLocationSlug(normalized, location.id);
    }
    await this.locations.save(location);
    return this.merchantHub(user, locationId);
  }

  async createCategory(user: User, locationId: string, dto: CreateMenuCategoryDto) {
    await this.assertManager(user, locationId);
    const maxRow = await this.categories.findOne({
      where: { locationId },
      order: { sortOrder: 'DESC' },
    });
    const location = await this.getLocationForMember(user, locationId);
    const category = await this.categories.save(
      this.categories.create({
        locationId,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? (maxRow?.sortOrder ?? 0) + 1,
      }),
    );
    const variantNames = defaultPriceVariantNames(location.businessCategory, location.menuMode);
    if (variantNames.length) {
      await this.seedCategoryVariants(category.id, variantNames);
    }
    return this.loadCategorySnapshot(locationId, category.id);
  }

  async updateCategory(
    user: User,
    locationId: string,
    categoryId: string,
    dto: UpdateMenuCategoryDto,
  ) {
    await this.assertManager(user, locationId);
    const category = await this.findCategory(locationId, categoryId);
    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    await this.categories.save(category);
    if (dto.priceVariants !== undefined) {
      const location = await this.getLocationForMember(user, locationId);
      if (this.priceVariantScope(location) === 'category') {
        await this.syncCategoryPriceVariants(category.id, dto.priceVariants);
      }
    }
    return this.loadCategorySnapshot(locationId, category.id);
  }

  async deleteCategory(user: User, locationId: string, categoryId: string) {
    await this.assertManager(user, locationId);
    const result = await this.categories.delete({ id: categoryId, locationId });
    if (!result.affected) throw this.notFound('Category not found');
    return { deleted: true };
  }

  async createItem(
    user: User,
    locationId: string,
    categoryId: string,
    dto: CreateMenuItemDto,
  ) {
    await this.assertManager(user, locationId);
    const category = await this.findCategory(locationId, categoryId);
    const location = await this.getLocationForMember(user, locationId);
    const scope = this.priceVariantScope(location);
    const maxRow = await this.items.findOne({
      where: { categoryId },
      order: { sortOrder: 'DESC' },
    });
    const item = await this.items.save(
      this.items.create({
        locationId,
        categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        priceInr: dto.priceInr ?? null,
        isNonVeg: dto.isNonVeg ?? false,
        isAvailable: dto.isAvailable ?? true,
        imageUrl: dto.imageUrl?.trim() || null,
        imageUrls: dto.imageUrls?.slice(0, MENU_PHOTO_SLOTS) ?? [],
        sortOrder: dto.sortOrder ?? (maxRow?.sortOrder ?? 0) + 1,
      }),
    );
    if (!item.imageUrls.length && item.imageUrl) {
      item.imageUrls = [item.imageUrl];
      item.imageUrl = null;
      await this.items.save(item);
    }
    const variants = await this.listCategoryVariants(category.id);
    if (scope === 'product') {
      await this.syncItemPriceOptions(item, dto.itemPriceOptions, dto.priceInr);
      const options = await this.listItemPriceOptions(item.id);
      return this.serializeItemWithProductOptions(item, options);
    }
    await this.applyItemVariantPrices(item, variants, dto.priceInr, dto.variantPrices);
    return this.serializeItemWithVariants(item, variants);
  }

  async updateItem(user: User, locationId: string, itemId: string, dto: UpdateMenuItemDto) {
    await this.assertManager(user, locationId);
    const location = await this.getLocationForMember(user, locationId);
    const scope = this.priceVariantScope(location);
    const item = await this.items.findOne({ where: { id: itemId, locationId } });
    if (!item) throw this.notFound('Item not found');
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.description !== undefined) item.description = dto.description.trim() || null;
    if (dto.priceInr !== undefined) item.priceInr = dto.priceInr;
    if (dto.isNonVeg !== undefined) item.isNonVeg = dto.isNonVeg;
    if (dto.isAvailable !== undefined) item.isAvailable = dto.isAvailable;
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl.trim() || null;
    if (dto.imageUrls !== undefined) {
      item.imageUrls = dto.imageUrls.slice(0, MENU_PHOTO_SLOTS);
      item.imageUrl = null;
    }
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    await this.items.save(item);
    if (scope === 'product') {
      if (dto.itemPriceOptions !== undefined || dto.priceInr !== undefined || dto.variantPrices !== undefined) {
        await this.syncItemPriceOptions(
          item,
          dto.itemPriceOptions,
          dto.priceInr !== undefined ? dto.priceInr : item.priceInr,
        );
      }
      const options = await this.listItemPriceOptions(item.id);
      return this.serializeItemWithProductOptions(item, options);
    }
    const variants = await this.listCategoryVariants(item.categoryId);
    if (dto.variantPrices !== undefined || dto.priceInr !== undefined) {
      await this.applyItemVariantPrices(
        item,
        variants,
        dto.priceInr !== undefined ? dto.priceInr : item.priceInr,
        dto.variantPrices,
      );
    }
    return this.serializeItemWithVariants(item, variants);
  }

  async deleteItem(user: User, locationId: string, itemId: string) {
    await this.assertManager(user, locationId);
    const result = await this.items.delete({ id: itemId, locationId });
    if (!result.affected) throw this.notFound('Item not found');
    return { deleted: true };
  }

  async getPublicHub(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const location = await this.locations.findOne({ where: { slug: normalized } });
    if (!location) throw this.notFound('Link not found');

    const menuUnlocked = await this.subscriptions.hasActiveProduct(
      location.id,
      BillingProduct.QUICK_MENU,
    );
    const revisitPath = menuUnlocked ? await this.publicQuickRevisitPath(location) : null;

    if (!menuUnlocked && !revisitPath) {
      throw new HttpException(
        {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message: 'Quick Commerce is not active for this business',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return {
      slug: location.slug!,
      locationName: location.name,
      menu: menuUnlocked ? { path: menuPublicPath(normalized) } : null,
      revisit: revisitPath ? { path: revisitPath } : null,
    };
  }

  async getPublicMenu(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const location = await this.locations.findOne({ where: { slug: normalized } });
    if (!location) throw this.notFound('Menu not found');
    await this.assertMenuLive(location.id);

    const categories = await this.loadCategories(location.id, { hideUnavailable: true });
    const copy = catalogCopyForLocation(location.businessCategory, location.menuMode);
    const quickRevisitPath = await this.publicQuickRevisitPath(location);
    return {
      slug: location.slug!,
      locationName: location.name,
      quickRevisitPath,
      address: location.address,
      phone: location.phone,
      menuMode: location.menuMode,
      businessCategory: location.businessCategory,
      catalogType: location.catalogType,
      presentation: copy.presentation,
      imagePlaceholder: menuImagePlaceholder(location.businessCategory, location.menuMode),
      priceVariantScope: usesCategoryPriceVariants(location.businessCategory, location.menuMode)
        ? 'category'
        : 'product',
      copy: {
        pageTitle: copy.pageTitle,
        showVegBadge: copy.showVegBadge,
        guestBrowse: catalogGuestBrowse(copy.presentation),
      },
      categories,
    };
  }

  private async ensureLegacyQuickCommerceSetup(location: Location): Promise<void> {
    if (location.quickCommerceSetupAt) return;
    const count = await this.categories.count({ where: { locationId: location.id } });
    if (count === 0) return;
    location.businessCategory = businessCategoryFromMenuMode(location.menuMode);
    location.catalogType = catalogTypeForCategory(location.businessCategory);
    location.quickCommerceSetupAt = location.createdAt ?? new Date();
    await this.locations.save(location);
  }

  private async loadCategories(locationId: string, opts?: { hideUnavailable?: boolean }) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    const scope = location ? this.priceVariantScope(location) : 'product';
    const rows = await this.categories.find({
      where: { locationId },
      order: { sortOrder: 'ASC' },
      relations: { items: true, priceVariants: scope === 'category' ? true : false },
    });
    const itemIds = rows.flatMap((category) => (category.items ?? []).map((item) => item.id));
    const priceRows =
      scope === 'category' && itemIds.length
        ? await this.itemVariantPrices.find({ where: { itemId: In(itemIds) } })
        : [];
    const pricesByItem = new Map<string, MenuItemVariantPrice[]>();
    for (const row of priceRows) {
      const bucket = pricesByItem.get(row.itemId) ?? [];
      bucket.push(row);
      pricesByItem.set(row.itemId, bucket);
    }
    const optionRows =
      scope === 'product' && itemIds.length
        ? await this.itemPriceOptions.find({
            where: { itemId: In(itemIds) },
            order: { sortOrder: 'ASC' },
          })
        : [];
    const optionsByItem = new Map<string, MenuItemPriceOption[]>();
    for (const row of optionRows) {
      const bucket = optionsByItem.get(row.itemId) ?? [];
      bucket.push(row);
      optionsByItem.set(row.itemId, bucket);
    }
    return rows.map((category) => {
      const variants =
        scope === 'category'
          ? [...(category.priceVariants ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
          : [];
      let items = [...(category.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      if (opts?.hideUnavailable) {
        items = items.filter((item) => item.isAvailable);
      }
      return this.serializeCategory(category, items, variants, pricesByItem, scope, optionsByItem);
    });
  }

  private async loadCategorySnapshot(locationId: string, categoryId: string) {
    const rows = await this.loadCategories(locationId);
    const match = rows.find((row) => row.id === categoryId);
    if (!match) throw this.notFound('Category not found');
    return match;
  }

  private serializeCategory(
    category: MenuCategory,
    items: MenuItem[],
    variants: MenuCategoryPriceVariant[],
    pricesByItem: Map<string, MenuItemVariantPrice[]>,
    scope: 'category' | 'product',
    optionsByItem: Map<string, MenuItemPriceOption[]>,
  ) {
    const serializedVariants =
      scope === 'category'
        ? variants.map((row) => ({
            id: row.id,
            name: row.name,
            sortOrder: row.sortOrder,
          }))
        : [];
    return {
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      priceVariants: serializedVariants,
      items: items.map((item) =>
        scope === 'product'
          ? this.serializeItemWithProductOptions(item, optionsByItem.get(item.id) ?? [])
          : this.serializeItemWithVariants(item, variants, pricesByItem.get(item.id) ?? []),
      ),
    };
  }

  private serializeItemWithVariants(
    item: MenuItem,
    variants: MenuCategoryPriceVariant[],
    stored?: MenuItemVariantPrice[],
  ) {
    const variantPrices = (stored ?? []).map((row) => ({
      variantId: row.variantId,
      priceInr: row.priceInr,
    }));
    const serializedVariants = variants.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    }));
    const pricing = itemPricingFields(item.priceInr, serializedVariants, variantPrices);
    const images = resolveMenuImageUrls(this.appBaseUrl(), item.id, item.imageUrls, item.imageUrl);
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      priceInr: item.priceInr,
      isNonVeg: item.isNonVeg,
      isAvailable: item.isAvailable,
      imageUrl: images[0] ?? null,
      imageUrls: images,
      sortOrder: item.sortOrder,
      ...pricing,
    };
  }

  private serializeItemWithProductOptions(item: MenuItem, options: MenuItemPriceOption[]) {
    const serializedVariants = options.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
    }));
    const variantPrices = options.map((row) => ({
      variantId: row.id,
      priceInr: row.priceInr,
    }));
    const pricing = itemPricingFields(item.priceInr, serializedVariants, variantPrices);
    const images = resolveMenuImageUrls(this.appBaseUrl(), item.id, item.imageUrls, item.imageUrl);
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      priceInr: item.priceInr,
      isNonVeg: item.isNonVeg,
      isAvailable: item.isAvailable,
      imageUrl: images[0] ?? null,
      imageUrls: images,
      sortOrder: item.sortOrder,
      priceVariants: serializedVariants,
      ...pricing,
    };
  }

  private async serializeItemResponse(item: MenuItem, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    const scope = location ? this.priceVariantScope(location) : 'category';
    if (scope === 'product') {
      const options = await this.listItemPriceOptions(item.id);
      return this.serializeItemWithProductOptions(item, options);
    }
    const variants = await this.listCategoryVariants(item.categoryId);
    const prices = await this.itemVariantPrices.find({ where: { itemId: item.id } });
    return this.serializeItemWithVariants(item, variants, prices);
  }

  private priceVariantScope(location: Location): 'category' | 'product' {
    return usesCategoryPriceVariants(location.businessCategory, location.menuMode) ? 'category' : 'product';
  }

  private async listItemPriceOptions(itemId: string): Promise<MenuItemPriceOption[]> {
    return this.itemPriceOptions.find({
      where: { itemId },
      order: { sortOrder: 'ASC' },
    });
  }

  private async syncItemPriceOptions(
    item: MenuItem,
    incoming: MenuItemPriceOptionDto[] | undefined,
    priceInr: number | null | undefined,
  ): Promise<void> {
    if (incoming === undefined) {
      if (priceInr !== undefined) {
        item.priceInr = priceInr;
        await this.items.save(item);
      }
      return;
    }

    const trimmed = incoming
      .map((row, index) => ({
        id: row.id,
        name: row.name.trim(),
        priceInr: row.priceInr,
        sortOrder: index,
      }))
      .filter((row) => row.name);

    if (!trimmed.length) {
      await this.itemPriceOptions.delete({ itemId: item.id });
      if (priceInr !== undefined) item.priceInr = priceInr;
      await this.items.save(item);
      return;
    }

    const names = new Set(trimmed.map((row) => row.name.toLowerCase()));
    if (names.size !== trimmed.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Each variation name must be unique on this product',
      });
    }
    for (const row of trimmed) {
      if (!Number.isFinite(row.priceInr) || row.priceInr < 0) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Each variation needs a non-negative price',
        });
      }
    }

    const existing = await this.listItemPriceOptions(item.id);
    const keepIds = new Set(trimmed.filter((row) => row.id).map((row) => row.id!));
    for (const row of existing) {
      if (!keepIds.has(row.id)) {
        await this.itemPriceOptions.delete({ id: row.id });
      }
    }
    for (const row of trimmed) {
      if (row.id) {
        const match = existing.find((v) => v.id === row.id);
        if (match) {
          match.name = row.name;
          match.sortOrder = row.sortOrder;
          match.priceInr = row.priceInr;
          await this.itemPriceOptions.save(match);
          continue;
        }
      }
      await this.itemPriceOptions.save(
        this.itemPriceOptions.create({
          itemId: item.id,
          name: row.name,
          sortOrder: row.sortOrder,
          priceInr: row.priceInr,
        }),
      );
    }

    const min = Math.min(...trimmed.map((row) => row.priceInr));
    item.priceInr = min;
    await this.items.save(item);
  }

  private appBaseUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }

  private mergePhotoSlot(stored: string[], slot: number): string[] {
    const slots: (string | null)[] = [null, null];
    for (const ref of stored) {
      if (ref === 'local:0') slots[0] = ref;
      else if (ref === 'local:1') slots[1] = ref;
      else if (!slots[0]) slots[0] = ref;
      else if (!slots[1]) slots[1] = ref;
    }
    slots[slot] = slot === 1 ? 'local:1' : 'local:0';
    return slots.filter((row): row is string => Boolean(row));
  }

  private async listCategoryVariants(categoryId: string): Promise<MenuCategoryPriceVariant[]> {
    return this.categoryVariants.find({
      where: { categoryId },
      order: { sortOrder: 'ASC' },
    });
  }

  private async seedCategoryVariants(categoryId: string, names: string[]): Promise<void> {
    for (let i = 0; i < names.length; i++) {
      await this.categoryVariants.save(
        this.categoryVariants.create({
          categoryId,
          name: names[i]!.trim(),
          sortOrder: i,
        }),
      );
    }
  }

  private async syncCategoryPriceVariants(
    categoryId: string,
    incoming: MenuCategoryPriceVariantDto[],
  ): Promise<void> {
    const trimmed = incoming.map((row, index) => ({
      id: row.id,
      name: row.name.trim(),
      sortOrder: index,
    }));
    const names = new Set(trimmed.map((row) => row.name.toLowerCase()));
    if (names.size !== trimmed.length) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Each price variant name must be unique within the category',
      });
    }
    const existing = await this.listCategoryVariants(categoryId);
    const keepIds = new Set(trimmed.filter((row) => row.id).map((row) => row.id!));
    for (const row of existing) {
      if (!keepIds.has(row.id)) {
        await this.categoryVariants.delete({ id: row.id });
      }
    }
    for (const row of trimmed) {
      if (row.id) {
        const match = existing.find((v) => v.id === row.id);
        if (match) {
          match.name = row.name;
          match.sortOrder = row.sortOrder;
          await this.categoryVariants.save(match);
          continue;
        }
      }
      await this.categoryVariants.save(
        this.categoryVariants.create({
          categoryId,
          name: row.name,
          sortOrder: row.sortOrder,
        }),
      );
    }
  }

  private async applyItemVariantPrices(
    item: MenuItem,
    variants: MenuCategoryPriceVariant[],
    priceInr: number | null | undefined,
    variantPrices?: MenuItemVariantPriceDto[],
  ): Promise<void> {
    if (!variants.length) {
      await this.itemVariantPrices.delete({ itemId: item.id });
      if (priceInr !== undefined) item.priceInr = priceInr;
      await this.items.save(item);
      return;
    }

    const variantIds = new Set(variants.map((row) => row.id));
    const normalized: MenuItemVariantPriceDto[] = [];

    if (variantPrices?.length) {
      for (const row of variantPrices) {
        if (!variantIds.has(row.variantId)) {
          throw new BadRequestException({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Variant price does not belong to this category',
          });
        }
        if (!Number.isFinite(row.priceInr) || row.priceInr < 0) {
          throw new BadRequestException({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Each variant price must be a non-negative number',
          });
        }
        normalized.push(row);
      }
    } else if (variants.length === 1 && priceInr != null && Number.isFinite(priceInr)) {
      normalized.push({ variantId: variants[0]!.id, priceInr });
    } else if (variants.length > 1) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Set a price for each size or portion',
      });
    }

    await this.itemVariantPrices.delete({ itemId: item.id });
    for (const row of normalized) {
      await this.itemVariantPrices.save(
        this.itemVariantPrices.create({
          itemId: item.id,
          variantId: row.variantId,
          priceInr: row.priceInr,
        }),
      );
    }
    const min = minVariantPrice(
      normalized.map((row) => ({ variantId: row.variantId, priceInr: row.priceInr })),
    );
    item.priceInr = min ?? (variants.length === 1 ? priceInr ?? null : item.priceInr);
    await this.items.save(item);
  }

  private async getLocationForMember(user: User, locationId: string): Promise<Location> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId);
    return location;
  }

  private async assertManager(user: User, locationId: string): Promise<void> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);
  }

  private async findCategory(locationId: string, categoryId: string): Promise<MenuCategory> {
    const category = await this.categories.findOne({ where: { id: categoryId, locationId } });
    if (!category) throw this.notFound('Category not found');
    return category;
  }

  private async ensureLocationSlug(location: Location): Promise<string> {
    if (location.slug) return location.slug;
    const base =
      slugifyMenuSlug(location.name) ||
      location.reviewCode?.toLowerCase() ||
      `shop-${location.id.slice(0, 6)}`;
    location.slug = await this.uniqueLocationSlug(base, location.id);
    await this.locations.save(location);
    return location.slug;
  }

  private async uniqueLocationSlug(desired: string, exceptLocationId?: string): Promise<string> {
    const base = desired.toLowerCase();
    for (let i = 0; i < 8; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const existing = await this.locations.findOne({ where: { slug: candidate } });
      if (!existing || existing.id === exceptLocationId) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async publicQuickRevisitPath(location: Location): Promise<string | null> {
    const settings = await this.revisitSettings.findOne({ where: { locationId: location.id } });
    if (!settings?.enabled) return null;
    const code = location.reviewCode ?? location.slug;
    if (!code) return null;
    return revisitPublicPath(code);
  }

  private async assertMenuLive(locationId: string): Promise<void> {
    const live = await this.subscriptions.hasActiveProduct(locationId, BillingProduct.QUICK_MENU);
    if (!live) {
      throw new HttpException(
        {
          code: ERROR_CODES.PAYMENT_REQUIRED,
          message: 'This page is not published yet. The business needs Quick Commerce active.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
