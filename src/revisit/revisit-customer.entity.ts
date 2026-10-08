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

@Entity('revisit_customers')
@Index(['businessId', 'mobileE164'], { unique: true })
export class RevisitCustomer {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  businessId: string;

  @Column({ type: 'varchar', length: 20 })
  mobileE164: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'datetime', nullable: true })
  firstVisitAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastVisitAt: Date | null;

  @Column({ type: 'int', default: 0 })
  totalVisits: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
