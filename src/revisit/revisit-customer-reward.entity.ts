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
import { RevisitRewardStatus } from './revisit.enums';

@Entity('revisit_customer_rewards')
@Index(['customerId', 'rewardId'], { unique: true })
export class RevisitCustomerReward {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  customerId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  rewardId: string;

  @Column({ type: 'timestamptz' })
  unlockedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  redeemedAt: Date | null;

  @Column({ type: 'varchar', length: 16, default: RevisitRewardStatus.UNLOCKED })
  status: RevisitRewardStatus;

  @Column({ type: 'varchar', length: 16 })
  rewardCode: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
