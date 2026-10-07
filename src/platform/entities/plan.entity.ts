import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../../common/utils/crypto';
import { BillingProduct } from '../enums/billing-product.enum';

@Entity('plans')
@Index(['code'], { unique: true, where: '"deletedAt" IS NULL' })
export class Plan {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 48 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 24, default: BillingProduct.QUICK_REVIEW })
  product: BillingProduct;

  @Column({ type: 'int' })
  amountInr: number;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
