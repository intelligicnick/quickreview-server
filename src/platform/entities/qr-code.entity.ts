import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../../common/utils/crypto';
import { Location } from '../../locations/location.entity';

@Entity('qr_codes')
export class QrCode {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  batchId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ type: 'text', nullable: true })
  targetUrl: string | null;

  /** True = menu QR, false = review QR, null = unassigned. */
  @Column({ type: 'boolean', nullable: true })
  isMenuQr: boolean | null;

  @Column({ type: 'boolean', default: false })
  isPrinted: boolean;

  @Column({ type: 'datetime', nullable: true })
  assignedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
