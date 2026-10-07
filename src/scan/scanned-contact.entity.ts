import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { Location } from '../locations/location.entity';

export type ScanCaptureMode = 'front' | 'back' | 'both';

@Entity('scanned_contacts')
@Index(['locationId', 'createdAt'])
export class ScannedContact {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 8 })
  captureMode: ScanCaptureMode;

  @Column({ type: 'varchar', length: 160, nullable: true })
  fullName: string | null;

  /** @deprecated unused — kept for existing DB rows */
  @Column({ type: 'varchar', length: 160, nullable: true })
  companyName: string | null;

  /** @deprecated unused — kept for existing DB rows */
  @Column({ type: 'varchar', length: 120, nullable: true })
  designation: string | null;

  @Column({ type: 'simple-json', default: () => "'[]'" })
  phones: string[];

  @Column({ type: 'simple-json', default: () => "'[]'" })
  emails: string[];

  @Column({ type: 'simple-json', default: () => "'[]'" })
  websites: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'simple-json', default: () => "'[]'" })
  services: string[];

  @Column({ type: 'simple-json', default: () => "'[]'" })
  products: string[];

  @Column({ type: 'varchar', length: 2000, nullable: true })
  notes: string | null;

  @Column({ type: 'bytea', nullable: true })
  frontImage: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  frontMimeType: string | null;

  @Column({ type: 'bytea', nullable: true })
  backImage: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  backMimeType: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
