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

  @Column({ type: 'simple-json' })
  phones: string[];

  @Column({ type: 'simple-json' })
  emails: string[];

  @Column({ type: 'simple-json' })
  websites: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'simple-json' })
  services: string[];

  @Column({ type: 'simple-json' })
  products: string[];

  @Column({ type: 'varchar', length: 2000, nullable: true })
  notes: string | null;

  @Column({ type: 'blob', nullable: true })
  frontImage: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  frontMimeType: string | null;

  @Column({ type: 'blob', nullable: true })
  backImage: Buffer | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  backMimeType: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
    if (this.phones == null) this.phones = [];
    if (this.emails == null) this.emails = [];
    if (this.websites == null) this.websites = [];
    if (this.services == null) this.services = [];
    if (this.products == null) this.products = [];
  }
}
