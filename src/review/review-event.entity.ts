import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { newId } from '../common/utils/crypto';
import { ReviewEventKind } from './review-event-kind.enum';

@Entity('review_events')
export class ReviewEvent {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @Column({ type: 'varchar', length: 24 })
  kind: ReviewEventKind;

  @Column({ type: 'smallint', nullable: true })
  stars: number | null;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
