import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { newId } from '../common/utils/crypto';
import { newReviewCode } from '../common/utils/review-code';
import { Location } from '../locations/location.entity';
import { LocationMenuMode } from '../locations/location-menu-mode.enum';
import { ReviewEvent } from '../review/review-event.entity';
import { ReviewEventKind } from '../review/review-event-kind.enum';
import { User } from '../users/user.entity';
import { ContactMessage } from '../platform/entities/contact-message.entity';
import { MarketplaceCategory } from '../platform/entities/marketplace-category.entity';
import { MarketplaceOrder } from '../platform/entities/marketplace-order.entity';
import { Payment } from '../platform/entities/payment.entity';
import { Plan } from '../platform/entities/plan.entity';
import { QrCode } from '../platform/entities/qr-code.entity';
import { QrProduct } from '../platform/entities/qr-product.entity';
import { Subscription } from '../platform/entities/subscription.entity';
import { BillingProduct } from '../platform/enums/billing-product.enum';
import { MarketplaceOrderStatus } from '../platform/enums/marketplace-order-status.enum';
import { PaymentKind } from '../platform/enums/payment-kind.enum';
import { PaymentProvider } from '../platform/enums/payment-provider.enum';
import { PaymentStatus } from '../platform/enums/payment-status.enum';
import { SubscriptionSource } from '../platform/enums/subscription-source.enum';
import { SubscriptionStatus } from '../platform/enums/subscription-status.enum';
import { menuPublicUrl, qrClaimUrl, reviewPublicUrl } from '../platform/qr-target.util';
import { QrCodesService } from '../platform/qr-codes.service';
import { SubscriptionsService } from '../platform/subscriptions.service';
import { AdminEvent } from './admin-event.entity';

const SHIP_QUEUE_STATUSES = [
  MarketplaceOrderStatus.PLACED,
  MarketplaceOrderStatus.CONFIRMED,
  MarketplaceOrderStatus.IN_PRODUCTION,
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class AdminPlatformService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(MarketplaceOrder) private readonly orders: Repository<MarketplaceOrder>,
    @InjectRepository(QrProduct) private readonly qrProducts: Repository<QrProduct>,
    @InjectRepository(MarketplaceCategory) private readonly marketplaceCategories: Repository<MarketplaceCategory>,
    @InjectRepository(QrCode) private readonly qrCodes: Repository<QrCode>,
    @InjectRepository(ContactMessage) private readonly contactMessages: Repository<ContactMessage>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(ReviewEvent) private readonly reviewEvents: Repository<ReviewEvent>,
    @InjectRepository(AdminEvent) private readonly events: Repository<AdminEvent>,
    private readonly qrCodesService: QrCodesService,
    private readonly subscriptionBilling: SubscriptionsService,
  ) {}

  private appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:5173';
  }

  async deskQueues() {
    const today = todayIso();
    const [pendingPayments, noPlanShops, ordersToShip, openContact] = await Promise.all([
      this.payments.count({ where: { status: PaymentStatus.PENDING } }),
      this.locationsWithoutLivePlan(today),
      this.orders.count({ where: { status: In(SHIP_QUEUE_STATUSES) } }),
      this.contactMessages.count({ where: { handledAt: IsNull() } }),
    ]);

    const [pendingPaymentRows, noPlanRows, orderRows, contactRows] = await Promise.all([
      this.payments.find({
        where: { status: PaymentStatus.PENDING },
        order: { createdAt: 'DESC' },
        take: 8,
        relations: { location: true, user: true },
      }),
      this.listNoPlanLocations(today, 8),
      this.orders.find({
        where: { status: In(SHIP_QUEUE_STATUSES) },
        order: { createdAt: 'DESC' },
        take: 8,
        relations: { location: true },
      }),
      this.contactMessages.find({
        where: { handledAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 8,
      }),
    ]);

    return {
      counts: {
        pendingPayments,
        noPlanShops,
        ordersToShip,
        contactMessages: openContact,
      },
      pendingPayments: pendingPaymentRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountInr: row.amountInr,
        provider: row.provider,
        locationName: row.location?.name ?? null,
        userEmail: row.user?.email ?? null,
        createdAt: row.createdAt,
      })),
      noPlanShops: noPlanRows,
      ordersToShip: orderRows.map((row) => ({
        id: row.id,
        status: row.status,
        businessNameSnapshot: row.businessNameSnapshot,
        locationName: row.location?.name ?? null,
        createdAt: row.createdAt,
      })),
      contactMessages: contactRows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        message: row.message.slice(0, 160),
        createdAt: row.createdAt,
      })),
    };
  }

  async listPlans() {
    const rows = await this.plans.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
    return rows.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      product: plan.product,
      amountInr: plan.amountInr,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    }));
  }

  async updatePlan(planId: string, patch: { isActive?: boolean; amountInr?: number }) {
    const plan = await this.plans.findOne({ where: { id: planId } });
    if (!plan) throw this.notFound('Plan not found');
    if (patch.isActive !== undefined) plan.isActive = patch.isActive;
    if (patch.amountInr !== undefined) plan.amountInr = patch.amountInr;
    await this.plans.save(plan);
    return plan;
  }

  async listSubscriptions(status?: SubscriptionStatus) {
    const qb = this.subscriptions
      .createQueryBuilder('sub')
      .innerJoinAndSelect('sub.location', 'location')
      .innerJoinAndSelect('sub.plan', 'plan')
      .innerJoinAndSelect('sub.user', 'user')
      .orderBy('sub.createdAt', 'DESC')
      .take(100);
    if (status) qb.andWhere('sub.status = :status', { status });
    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      source: row.source,
      product: row.product,
      startDate: row.startDate,
      endDate: row.endDate,
      amountInr: row.amountInr,
      location: { id: row.location.id, name: row.location.name },
      plan: { id: row.plan.id, name: row.plan.name },
      user: { id: row.user.id, email: row.user.email },
    }));
  }

  async grantComp(actor: User, body: { locationId: string; planId: string; note?: string }) {
    const location = await this.locations.findOne({
      where: { id: body.locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    const plan = await this.plans.findOne({ where: { id: body.planId, isActive: true } });
    if (!plan) throw this.notFound('Plan not found');

    const today = todayIso();
    const end = addDaysIso(today, plan.durationDays);
    const sub = await this.subscriptions.save(
      this.subscriptions.create({
        locationId: location.id,
        userId: location.business.ownerUserId,
        planId: plan.id,
        product: plan.product,
        status: SubscriptionStatus.ACTIVE,
        source: SubscriptionSource.COMP,
        startDate: today,
        endDate: end,
        amountInr: 0,
      }),
    );
    await this.log(actor.id, 'SUBSCRIPTION_COMP', `Comp ${plan.name} for ${location.name}`);
    return { id: sub.id, endDate: sub.endDate };
  }

  async createManualPayment(
    actor: User,
    body: { locationId: string; planId: string; provider: PaymentProvider.UPI | PaymentProvider.CASH },
  ) {
    const location = await this.locations.findOne({
      where: { id: body.locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    const plan = await this.plans.findOne({ where: { id: body.planId, isActive: true } });
    if (!plan) throw this.notFound('Plan not found');

    const today = todayIso();
    const end = addDaysIso(today, plan.durationDays);
    const sub = await this.subscriptions.save(
      this.subscriptions.create({
        locationId: location.id,
        userId: location.business.ownerUserId,
        planId: plan.id,
        product: plan.product,
        status: SubscriptionStatus.PENDING_PAYMENT,
        source: body.provider === PaymentProvider.UPI ? SubscriptionSource.UPI : SubscriptionSource.CASH,
        startDate: today,
        endDate: end,
        amountInr: plan.amountInr,
      }),
    );
    const payment = await this.payments.save(
      this.payments.create({
        kind: PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        provider: body.provider,
        amountInr: plan.amountInr,
        userId: location.business.ownerUserId,
        locationId: location.id,
        subscriptionId: sub.id,
      }),
    );
    await this.log(actor.id, 'PAYMENT_CREATED', `Pending ${body.provider} for ${location.name}`);
    return { paymentId: payment.id, subscriptionId: sub.id };
  }

  async markPaymentPaid(actor: User, paymentId: string, note?: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw this.notFound('Payment not found');
    const result = await this.subscriptionBilling.confirmPaymentSuccess(paymentId, note);
    await this.log(actor.id, 'PAYMENT_CONFIRMED', `Marked paid ${payment.amountInr} INR`);
    return result;
  }

  async subscriptionInvoice(subscriptionId: string) {
    const sub = await this.subscriptions.findOne({
      where: { id: subscriptionId },
      relations: { plan: true, location: true, user: true },
    });
    if (!sub) throw this.notFound('Subscription not found');
    return {
      invoiceNumber: `QR-${sub.id.slice(0, 8).toUpperCase()}`,
      issuedAt: sub.createdAt,
      billTo: { name: sub.user.name, email: sub.user.email },
      location: sub.location.name,
      plan: sub.plan.name,
      amountInr: sub.amountInr,
      period: { start: sub.startDate, end: sub.endDate },
      source: sub.source,
    };
  }

  async listPayments(status?: PaymentStatus) {
    const qb = this.payments
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.location', 'location')
      .leftJoinAndSelect('payment.user', 'user')
      .orderBy('payment.createdAt', 'DESC')
      .take(100);
    if (status) qb.andWhere('payment.status = :status', { status });
    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      provider: row.provider,
      amountInr: row.amountInr,
      locationName: row.location?.name ?? null,
      userEmail: row.user?.email ?? null,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
    }));
  }

  async listQrProducts() {
    return this.qrProducts.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: { category: true },
    });
  }

  async createQrProduct(input: {
    name: string;
    description?: string;
    dimensions?: string;
    categoryId?: string;
    imageUrl?: string;
    priceInr: number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const categoryId = input.categoryId ? await this.requireCategoryId(input.categoryId) : null;
    return this.qrProducts.save(
      this.qrProducts.create({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        dimensions: input.dimensions?.trim() || null,
        categoryId,
        imageUrl: input.imageUrl?.trim() || null,
        priceInr: input.priceInr,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      }),
    );
  }

  async updateQrProduct(
    productId: string,
    patch: {
      name?: string;
      priceInr?: number;
      isActive?: boolean;
      description?: string;
      dimensions?: string;
      categoryId?: string | null;
      imageUrl?: string | null;
      sortOrder?: number;
    },
  ) {
    const product = await this.qrProducts.findOne({ where: { id: productId } });
    if (!product) throw this.notFound('Product not found');
    if (patch.name !== undefined) product.name = patch.name.trim();
    if (patch.description !== undefined) product.description = patch.description?.trim() || null;
    if (patch.dimensions !== undefined) product.dimensions = patch.dimensions?.trim() || null;
    if (patch.imageUrl !== undefined) product.imageUrl = patch.imageUrl?.trim() || null;
    if (patch.priceInr !== undefined) product.priceInr = patch.priceInr;
    if (patch.sortOrder !== undefined) product.sortOrder = patch.sortOrder;
    if (patch.isActive !== undefined) product.isActive = patch.isActive;
    if (patch.categoryId !== undefined) {
      product.categoryId = patch.categoryId ? await this.requireCategoryId(patch.categoryId) : null;
    }
    return this.qrProducts.save(product);
  }

  async listMarketplaceCategories() {
    return this.marketplaceCategories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async createMarketplaceCategory(input: { name: string; sortOrder?: number }) {
    return this.marketplaceCategories.save(
      this.marketplaceCategories.create({
        name: input.name.trim(),
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      }),
    );
  }

  async updateMarketplaceCategory(
    categoryId: string,
    patch: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const category = await this.marketplaceCategories.findOne({ where: { id: categoryId } });
    if (!category) throw this.notFound('Category not found');
    if (patch.name !== undefined) category.name = patch.name.trim();
    if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder;
    if (patch.isActive !== undefined) category.isActive = patch.isActive;
    return this.marketplaceCategories.save(category);
  }

  private async requireCategoryId(categoryId: string): Promise<string> {
    const category = await this.marketplaceCategories.findOne({ where: { id: categoryId } });
    if (!category) throw this.notFound('Category not found');
    return category.id;
  }

  async listOrders(status?: MarketplaceOrderStatus) {
    const qb = this.orders
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.location', 'location')
      .leftJoinAndSelect('order.product', 'product')
      .orderBy('order.createdAt', 'DESC')
      .take(100);
    if (status) qb.andWhere('order.status = :status', { status });
    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      designName: row.designName,
      quantity: row.quantity,
      amountInr: row.amountInr,
      businessNameSnapshot: row.businessNameSnapshot,
      phoneNumber: row.phoneNumber,
      locationName: row.location.name,
      productName: row.product?.name ?? null,
      createdAt: row.createdAt,
    }));
  }

  async updateOrderStatus(actor: User, orderId: string, status: MarketplaceOrderStatus) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw this.notFound('Order not found');
    order.status = status;
    await this.orders.save(order);
    await this.log(actor.id, 'ORDER_UPDATED', `Order ${orderId} → ${status}`);
    return { id: order.id, status: order.status };
  }

  async listQrCodes(batchId?: string, unassignedOnly?: boolean) {
    const qb = this.qrCodes.createQueryBuilder('qr').orderBy('qr.createdAt', 'DESC').take(200);
    if (batchId) qb.andWhere('qr.batchId = :batchId', { batchId });
    if (unassignedOnly) qb.andWhere('qr.locationId IS NULL');
    const rows = await qb.getMany();
    const app = this.appUrl();
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      batchId: row.batchId,
      claimUrl: qrClaimUrl(app, row.code),
      locationId: row.locationId,
      targetUrl: row.targetUrl,
      isMenuQr: row.isMenuQr,
      isPrinted: row.isPrinted,
      assignedAt: row.assignedAt,
      createdAt: row.createdAt,
    }));
  }

  async createQrBatch(actor: User, size = 20) {
    const count = Math.min(Math.max(size, 1), 200);
    const batchId = newId();
    const app = this.appUrl();
    const codes: QrCode[] = [];
    for (let i = 0; i < count; i++) {
      let code = newReviewCode(8);
      for (let attempt = 0; attempt < 5; attempt++) {
        const exists = await this.qrCodes.exist({ where: { code } });
        if (!exists) break;
        code = newReviewCode(8);
      }
      codes.push(
        this.qrCodes.create({
          code,
          batchId,
          targetUrl: qrClaimUrl(app, code),
        }),
      );
    }
    await this.qrCodes.save(codes);
    await this.log(actor.id, 'QR_BATCH', `Created batch ${batchId} (${count} codes)`);
    return { batchId, size: count, codes: codes.map((row) => row.code) };
  }

  async assignQrCode(
    actor: User,
    codeId: string,
    body: { locationId: string; kind: 'review' | 'menu' },
  ) {
    const qr = await this.qrCodes.findOne({ where: { id: codeId } });
    if (!qr) throw this.notFound('QR code not found');
    const location = await this.locations.findOne({ where: { id: body.locationId } });
    if (!location) throw this.notFound('Location not found');
    await this.qrCodesService.assignQrToLocation(qr, location, body.kind);
    await this.log(actor.id, 'QR_ASSIGNED', `${qr.code} → ${location.name} (${body.kind})`);
    const saved = await this.qrCodes.findOne({ where: { id: qr.id } });
    return { id: qr.id, code: qr.code, targetUrl: saved?.targetUrl ?? qr.targetUrl };
  }

  async unassignQrCode(actor: User, codeId: string) {
    const qr = await this.qrCodes.findOne({ where: { id: codeId } });
    if (!qr) throw this.notFound('QR code not found');
    await this.qrCodesService.resetToClaimable(qr);
    await this.log(actor.id, 'QR_UNASSIGNED', qr.code);
    return { id: qr.id, code: qr.code };
  }

  async setQrPrinted(actor: User, codeId: string, isPrinted: boolean) {
    const qr = await this.qrCodes.findOne({ where: { id: codeId } });
    if (!qr) throw this.notFound('QR code not found');
    qr.isPrinted = isPrinted;
    await this.qrCodes.save(qr);
    await this.log(actor.id, 'QR_PRINTED', `${qr.code} printed=${isPrinted}`);
    return { id: qr.id, isPrinted: qr.isPrinted };
  }

  async listContactMessages(openOnly?: boolean) {
    const qb = this.contactMessages.createQueryBuilder('msg').orderBy('msg.createdAt', 'DESC').take(100);
    if (openOnly) qb.andWhere('msg.handledAt IS NULL');
    return qb.getMany();
  }

  async markContactHandled(actor: User, messageId: string) {
    const row = await this.contactMessages.findOne({ where: { id: messageId } });
    if (!row) throw this.notFound('Message not found');
    row.handledAt = new Date();
    await this.contactMessages.save(row);
    await this.log(actor.id, 'CONTACT_HANDLED', row.email);
    return { id: row.id, handledAt: row.handledAt };
  }

  async refreshLocationMetrics(actor: User, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    const scans = await this.reviewEvents.count({
      where: { locationId, kind: ReviewEventKind.PAGE_VIEW },
    });
    location.scanCount = scans;
    location.metricsRefreshedAt = new Date();
    await this.locations.save(location);
    await this.log(actor.id, 'METRICS_REFRESH', location.name);
    return {
      id: location.id,
      scanCount: location.scanCount,
      metricsRefreshedAt: location.metricsRefreshedAt,
    };
  }

  async updateLocationFields(
    actor: User,
    locationId: string,
    patch: { slug?: string | null; menuMode?: LocationMenuMode },
  ) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) throw this.notFound('Location not found');
    if (patch.slug !== undefined) {
      const slug = patch.slug?.trim().toLowerCase() || null;
      if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Slug must be lowercase letters, numbers, and hyphens',
        });
      }
      if (slug) {
        const taken = await this.locations.exist({ where: { slug } });
        if (taken && location.slug !== slug) {
          throw new BadRequestException({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'That slug is already taken',
          });
        }
      }
      location.slug = slug;
    }
    if (patch.menuMode !== undefined) location.menuMode = patch.menuMode;
    await this.locations.save(location);
    return {
      id: location.id,
      slug: location.slug,
      menuMode: location.menuMode,
    };
  }

  private async locationsWithoutLivePlan(today: string): Promise<number> {
    const qb = this.locations
      .createQueryBuilder('location')
      .leftJoin(
        Subscription,
        'sub',
        `sub.locationId = location.id AND sub.product = :quickReview AND sub.status = :active AND sub.endDate >= :today AND sub.startDate <= :today`,
        {
          active: SubscriptionStatus.ACTIVE,
          today,
          quickReview: BillingProduct.QUICK_REVIEW,
        },
      )
      .where('sub.id IS NULL');
    return qb.getCount();
  }

  private async listNoPlanLocations(today: string, take: number) {
    const rows = await this.locations
      .createQueryBuilder('location')
      .innerJoinAndSelect('location.business', 'business')
      .leftJoin(
        Subscription,
        'sub',
        `sub.locationId = location.id AND sub.product = :quickReview AND sub.status = :active AND sub.endDate >= :today AND sub.startDate <= :today`,
        {
          active: SubscriptionStatus.ACTIVE,
          today,
          quickReview: BillingProduct.QUICK_REVIEW,
        },
      )
      .where('sub.id IS NULL')
      .orderBy('location.createdAt', 'DESC')
      .take(take)
      .getMany();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      businessName: row.business.name,
      createdAt: row.createdAt,
    }));
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }

  private async log(actorUserId: string, action: string, summary: string) {
    await this.events.save(this.events.create({ actorUserId, action, summary }));
  }
}
