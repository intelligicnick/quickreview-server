import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { newId } from '../common/utils/crypto';

@Entity('admin_events')
export class AdminEvent {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  actorUserId: string;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'varchar', length: 500 })
  summary: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
