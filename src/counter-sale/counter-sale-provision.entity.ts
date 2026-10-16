import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { CounterSaleServiceKind } from './counter-sale-service.enum';

@Entity('counter_sale_provisions')
export class CounterSaleProvision {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  businessId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  qrCode: string;

  @Column({ type: 'varchar', length: 16 })
  service: CounterSaleServiceKind;

  @Column({ type: 'varchar', length: 36, nullable: true })
  provisionedByAgentId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  provisionedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
