import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';

@Entity('design_generations')
@Index(['locationId', 'createdAt'])
export class DesignGeneration {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  posterId: string | null;

  @Column({ type: 'varchar', length: 16 })
  status: 'success' | 'failed';

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
