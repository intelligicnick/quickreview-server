import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';

@Entity('counter_sale_agents')
export class CounterSaleAgent {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  pinHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 36, nullable: true })
  createdByUserId: string | null;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
