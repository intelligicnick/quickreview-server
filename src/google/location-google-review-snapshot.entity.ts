import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { newId } from '../common/utils/crypto';

@Entity('location_google_review_snapshots')
@Unique('UQ_location_google_review_snapshots_day', ['locationId', 'snapshotDate'])
export class LocationGoogleReviewSnapshot {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  /** UTC calendar day (YYYY-MM-DD). */
  @Column({ type: 'varchar', length: 10 })
  snapshotDate: string;

  @Column({ type: 'int' })
  reviewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
