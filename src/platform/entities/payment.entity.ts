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
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { MarketplaceOrder } from './marketplace-order.entity';
import { Subscription } from './subscription.entity';

@Entity('payments')
@Index(['status'])
export class Payment {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 20 })
  kind: PaymentKind;

  @Column({ type: 'varchar', length: 16 })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  provider: PaymentProvider | null;

  @Column({ type: 'int' })
  amountInr: number;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 36, nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  orderId: string | null;

  @ManyToOne(() => MarketplaceOrder, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: MarketplaceOrder | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
