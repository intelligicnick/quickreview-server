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
import { PlaceMarketplaceOrderDto } from './dto/marketplace.dto';
import { MarketplaceOrder } from './entities/marketplace-order.entity';
import { Payment } from './entities/payment.entity';
import { MarketplaceCategory } from './entities/marketplace-category.entity';
import { QrProduct } from './entities/qr-product.entity';
import { MarketplaceOrderStatus } from './enums/marketplace-order-status.enum';
import { PaymentKind } from './enums/payment-kind.enum';
import { PaymentStatus } from './enums/payment-status.enum';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(QrProduct) private readonly products: Repository<QrProduct>,
    @InjectRepository(MarketplaceCategory) private readonly categories: Repository<MarketplaceCategory>,
    @InjectRepository(MarketplaceOrder) private readonly orders: Repository<MarketplaceOrder>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    private readonly members: MembersService,
  ) {}

  async merchantHub(user: User, locationId: string) {
    const location = await this.getLocationForMember(user, locationId);
    const [catalog, categoryRows, orderRows] = await Promise.all([
      this.products.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      this.categories.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      this.orders.find({
        where: { locationId },
        order: { createdAt: 'DESC' },
        relations: { product: true },
        take: 50,
      }),
    ]);

    const pendingPayments = await this.payments.find({
      where: {
        locationId,
        kind: PaymentKind.ORDER,
        status: PaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    const pendingByOrder = new Map(
      pendingPayments.filter((p) => p.orderId).map((p) => [p.orderId!, p.id]),
    );

    return {
      locationId,
      locationName: location.name,
      businessName: location.business?.name ?? location.name,
      categories: categoryRows.map((row) => ({
        id: row.id,
        name: row.name,
      })),
      products: catalog.map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        name: row.name,
        description: row.description,
        dimensions: row.dimensions,
        imageUrl: row.imageUrl,
        priceInr: row.priceInr,
      })),
      orders: orderRows.map((row) => this.serializeOrder(row, pendingByOrder.get(row.id) ?? null)),
    };
  }

  async placeOrder(user: User, locationId: string, dto: PlaceMarketplaceOrderDto) {
    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId, MANAGER_ROLES);

    const product = await this.products.findOne({ where: { id: dto.productId, isActive: true } });
    if (!product) throw this.notFound('Product not found or unavailable');

    const quantity = Math.min(Math.max(dto.quantity ?? 1, 1), 20);
    const amountInr = product.priceInr * quantity;
    if (amountInr <= 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid product price',
      });
    }

    const designName = dto.designName?.trim() || product.name;
    const businessNameSnapshot = location.business?.name ?? location.name;

    const order = await this.orders.save(
      this.orders.create({
        userId: user.id,
        locationId: location.id,
        productId: product.id,
        designName,
        amountInr,
        quantity,
        businessNameSnapshot,
        phoneNumber: dto.phoneNumber.trim(),
        status: MarketplaceOrderStatus.PLACED,
      }),
    );

    const payment = await this.payments.save(
      this.payments.create({
        kind: PaymentKind.ORDER,
        status: PaymentStatus.PENDING,
        provider: dto.provider,
        amountInr,
        userId: user.id,
        locationId: location.id,
        orderId: order.id,
      }),
    );

    order.product = product;
    return {
      order: this.serializeOrder(order, payment.id),
      paymentId: payment.id,
      message:
        'Order placed — payment pending confirmation. We will start production once UPI/cash is marked paid.',
    };
  }

  private serializeOrder(order: MarketplaceOrder, pendingPaymentId: string | null) {
    return {
      id: order.id,
      status: order.status,
      designName: order.designName,
      quantity: order.quantity,
      amountInr: order.amountInr,
      phoneNumber: order.phoneNumber,
      businessNameSnapshot: order.businessNameSnapshot,
      productName: order.product?.name ?? null,
      productId: order.productId,
      pendingPaymentId,
      createdAt: order.createdAt,
    };
  }

  private async getLocationForMember(user: User, locationId: string): Promise<Location> {
    const location = await this.locations.findOne({
      where: { id: locationId },
      relations: { business: true },
    });
    if (!location) throw this.notFound('Location not found');
    await this.members.assertMember(user, location.businessId);
    return location;
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ERROR_CODES.NOT_FOUND, message });
  }
}
