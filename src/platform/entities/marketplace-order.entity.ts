import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../../common/utils/crypto';
import { Location } from '../../locations/location.entity';
import { User } from '../../users/user.entity';
import { MarketplaceOrderStatus } from '../enums/marketplace-order-status.enum';
import { QrProduct } from './qr-product.entity';

@Entity('marketplace_orders')
export class MarketplaceOrder {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 36, nullable: true })
  productId: string | null;

  @ManyToOne(() => QrProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'productId' })
  product: QrProduct | null;

  @Column({ type: 'varchar', length: 120 })
  designName: string;

  @Column({ type: 'int' })
  amountInr: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', length: 255 })
  businessNameSnapshot: string;

  @Column({ type: 'varchar', length: 32 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 24 })
  status: MarketplaceOrderStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
