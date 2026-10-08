import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { REVISIT_SOURCE } from './revisit.enums';

@Entity('revisit_visits')
@Index(['customerId', 'visitedAt'])
@Index(['businessId', 'visitedAt'])
@Index(['locationId', 'visitedAt'])
@Index(['idempotencyKey'], { unique: true })
export class RevisitVisit {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  customerId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  businessId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  qrId: string | null;

  @Column({ type: 'varchar', length: 20 })
  mobileE164: string;

  @Column({ type: 'datetime' })
  visitedAt: Date;

  @Column({ type: 'int' })
  visitNumber: number;

  @Column({ type: 'varchar', length: 32, default: REVISIT_SOURCE })
  source: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
