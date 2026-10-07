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
import { BillingProduct } from '../enums/billing-product.enum';
import { SubscriptionSource } from '../enums/subscription-source.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { Plan } from './plan.entity';

@Entity('subscriptions')
@Index(['locationId', 'product'])
@Index(['status'])
export class Subscription {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 36 })
  planId: string;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @Column({ type: 'varchar', length: 24 })
  product: BillingProduct;

  @Column({ type: 'varchar', length: 24 })
  status: SubscriptionStatus;

  @Column({ type: 'varchar', length: 16 })
  source: SubscriptionSource;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'int' })
  amountInr: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
