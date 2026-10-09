import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../common/constants';
import { Location } from '../locations/location.entity';
import { MANAGER_ROLES } from '../members/member-role.enum';
import { MembersService } from '../members/members.service';
import { User } from '../users/user.entity';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { Payment } from './entities/payment.entity';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { MarketplaceOrderStatus } from './enums/marketplace-order-status.enum';
import { RazorpayService } from './razorpay.service';
import { BillingProduct } from './enums/billing-product.enum';
import { PaymentKind } from './enums/payment-kind.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { SubscriptionSource } from './enums/subscription-source.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';

export type ProductAccessStatus = 'NONE' | 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type ProductAccess = {
  product: BillingProduct;
  unlocked: boolean;
  status: ProductAccessStatus;
  planId: string | null;
  planName: string | null;
  startDate: string | null;
  endDate: string | null;
  amountInr: number | null;
  pendingPaymentId: string | null;
  subscriptionId: string | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(MarketplaceOrder) private readonly orders: Repository<MarketplaceOrder>,
    private readonly members: MembersService,
    private readonly razorpay: RazorpayService,
  ) {}

  async findPendingPaymentByRazorpayOrder(orderId: string): Promise<Payment | null> {
    const ref = this.razorpay.orderReference(orderId);
    return this.payments.findOne({
      where: { referenceNote: ref, status: PaymentStatus.PENDING },
    });
  }

  async confirmPaymentSuccess(paymentId: string, note?: string) {
    const payment = await this.payments.findOne({
      where: { id: paymentId },
      relations: { subscription: true },
    });
    if (!payment) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Payment not found' });
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Only pending payments can be confirmed',
      });
    }
    payment.status = PaymentStatus.SUCCEEDED;
    payment.paidAt = new Date();
    if (note) payment.referenceNote = note.slice(0, 64);
    await this.payments.save(payment);

    if (payment.subscriptionId && payment.subscription) {
      payment.subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptions.save(payment.subscription);
    }
    if (payment.orderId) {
      const order = await this.orders.findOne({ where: { id: payment.orderId } });
      if (order && order.status === MarketplaceOrderStatus.PLACED) {
        order.status = MarketplaceOrderStatus.CONFIRMED;
        await this.orders.save(order);
      }
    }
    return { id: payment.id, status: payment.status };
  }

  async rejectPayment(paymentId: string, reason: string) {
    const payment = await this.payments.findOne({
      where: { id: paymentId },
      relations: { subscription: true },
    });
    if (!payment) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Payment not found' });
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Only pending payments can be rejected',
      });
    }
    payment.status = PaymentStatus.FAILED;
    payment.referenceNote = reason.slice(0, 64);
    await this.payments.save(payment);
    if (payment.subscriptionId && payment.subscription) {
      payment.subscription.status = SubscriptionStatus.CANCELLED;
      await this.subscriptions.save(payment.subscription);
    }
    return { id: payment.id, status: payment.status };
  }

  async listActivePlans(product?: BillingProduct) {
    const rows = await this.plans.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const filtered = product ? rows.filter((row) => row.product === product) : rows;
    return filtered.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      product: plan.product,
      amountInr: plan.amountInr,
      durationDays: plan.durationDays,
    }));
  }

  async hasActiveProduct(locationId: string, product: BillingProduct): Promise<boolean> {
    const access = await this.getProductAccess(locationId, product);
    return access.unlocked;
  }

  async getProductAccess(locationId: string, product: BillingProduct): Promise<ProductAccess> {
    const today = todayIso();
    const rows = await this.subscriptions.find({
      where: { locationId, product },
      order: { createdAt: 'DESC' },
      take: 5,
      relations: { plan: true },
    });

    const active = rows.find(
      (row) =>
        row.status === SubscriptionStatus.ACTIVE &&
        row.startDate <= today &&
        row.endDate >= today,
    );
    if (active) {
      return {
        product,
        unlocked: true,
        status: 'ACTIVE',
        planId: active.planId,
        planName: active.plan?.name ?? null,
        startDate: active.startDate,
        endDate: active.endDate,
        amountInr: active.amountInr,
        pendingPaymentId: null,
        subscriptionId: active.id,
      };
    }

    const pending = rows.find((row) => row.status === SubscriptionStatus.PENDING_PAYMENT);
    if (pending) {
      const payment = await this.payments.findOne({
        where: { subscriptionId: pending.id, status: PaymentStatus.PENDING },
        order: { createdAt: 'DESC' },
      });
      return {
        product,
        unlocked: false,
        status: 'PENDING_PAYMENT',
        planId: pending.planId,
        planName: pending.plan?.name ?? null,
        startDate: pending.startDate,
        endDate: pending.endDate,
        amountInr: pending.amountInr,
        pendingPaymentId: payment?.id ?? null,
        subscriptionId: pending.id,
      };
    }

    const expired = rows.find(
      (row) =>
        row.status === SubscriptionStatus.EXPIRED ||
        (row.status === SubscriptionStatus.ACTIVE && row.endDate < today),
    );
    if (expired) {
      return {
        product,
        unlocked: false,
        status: 'EXPIRED',
        planId: expired.planId,
        planName: expired.plan?.name ?? null,
        startDate: expired.startDate,
        endDate: expired.endDate,
        amountInr: expired.amountInr,
        pendingPaymentId: null,
        subscriptionId: expired.id,
      };
    }

    return {
      product,
      unlocked: false,
      status: 'NONE',
      planId: null,
      planName: null,
      startDate: null,
      endDate: null,
      amountInr: null,
      pendingPaymentId: null,
      subscriptionId: null,
    };
  }

  async getLocationBilling(user: User, locationId: string) {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    await this.members.assertMember(user, location.businessId);
    const [quickReview, quickMenu, quickConnect, quickDesign, quickScan, quickCrm, plans] =
      await Promise.all([
      this.getProductAccess(locationId, BillingProduct.QUICK_REVIEW),
      this.getProductAccess(locationId, BillingProduct.QUICK_MENU),
      this.getProductAccess(locationId, BillingProduct.QUICK_CONNECT),
      this.getProductAccess(locationId, BillingProduct.QUICK_DESIGN),
      this.getProductAccess(locationId, BillingProduct.QUICK_SCAN),
      this.getProductAccess(locationId, BillingProduct.QUICK_CRM),
      this.listActivePlans(),
    ]);
    return {
      locationId,
      locationName: location.name,
      products: { quickReview, quickMenu, quickConnect, quickDesign, quickScan, quickCrm },
      plans,
    };
  }

  async startCheckout(
    user: User,
    locationId: string,
    planId: string,
    provider?: PaymentProvider,
  ) {
    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Location not found' });
    }
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);

    const plan = await this.plans.findOne({ where: { id: planId, isActive: true } });
    if (!plan) {
      throw new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message: 'Plan not found' });
    }

    const current = await this.getProductAccess(locationId, plan.product);
    if (current.unlocked) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'This location already has an active plan for that product',
      });
    }
    if (current.status === 'PENDING_PAYMENT') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A payment is already pending for this product. Wait for confirmation or contact support.',
      });
    }

    if (plan.amountInr === 0) {
      const today = todayIso();
      const sub = await this.subscriptions.save(
        this.subscriptions.create({
          locationId: location.id,
          userId: user.id,
          planId: plan.id,
          product: plan.product,
          status: SubscriptionStatus.ACTIVE,
          source: SubscriptionSource.COMP,
          startDate: today,
          endDate: addDaysIso(today, plan.durationDays),
          amountInr: 0,
        }),
      );
      return {
        subscriptionId: sub.id,
        paymentId: null,
        status: SubscriptionStatus.ACTIVE,
        message: 'Plan activated',
      };
    }

    if (
      !provider ||
      (provider !== PaymentProvider.UPI &&
        provider !== PaymentProvider.CASH &&
        provider !== PaymentProvider.RAZORPAY)
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Choose Razorpay, UPI, or cash for paid plans',
      });
    }

    if (provider === PaymentProvider.RAZORPAY && !this.razorpay.isConfigured()) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Online card/UPI checkout is not configured on this server yet',
      });
    }

    const today = todayIso();
    const source =
      provider === PaymentProvider.RAZORPAY
        ? SubscriptionSource.RAZORPAY
        : provider === PaymentProvider.UPI
          ? SubscriptionSource.UPI
          : SubscriptionSource.CASH;

    const sub = await this.subscriptions.save(
      this.subscriptions.create({
        locationId: location.id,
        userId: user.id,
        planId: plan.id,
        product: plan.product,
        status: SubscriptionStatus.PENDING_PAYMENT,
        source,
        startDate: today,
        endDate: addDaysIso(today, plan.durationDays),
        amountInr: plan.amountInr,
      }),
    );
    const payment = await this.payments.save(
      this.payments.create({
        kind: PaymentKind.SUBSCRIPTION,
        status: PaymentStatus.PENDING,
        provider,
        amountInr: plan.amountInr,
        userId: user.id,
        locationId: location.id,
        subscriptionId: sub.id,
      }),
    );

    if (provider === PaymentProvider.RAZORPAY) {
      const order = await this.razorpay.createOrder(plan.amountInr * 100, payment.id);
      payment.referenceNote = this.razorpay.orderReference(order.id);
      await this.payments.save(payment);
      return {
        subscriptionId: sub.id,
        paymentId: payment.id,
        status: SubscriptionStatus.PENDING_PAYMENT,
        message: 'Complete payment in the Razorpay window',
        razorpay: {
          keyId: this.razorpay.publicKeyId(),
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      };
    }

    return {
      subscriptionId: sub.id,
      paymentId: payment.id,
      status: SubscriptionStatus.PENDING_PAYMENT,
      message: 'Pending payment — we will activate your plan once payment is confirmed',
    };
  }
}
