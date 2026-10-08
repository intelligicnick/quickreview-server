import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { Business } from '../businesses/business.entity';
import { BusinessCategory } from '../catalog/business-category.enum';
import { CatalogType } from '../catalog/catalog-type.enum';
import { LocationMenuMode } from './location-menu-mode.enum';
import { LocationStatus } from './location-status.enum';

@Entity('locations')
export class Location {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  businessId: string;

  @ManyToOne(() => Business, (business) => business.locations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  googleReviewUrl: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  googlePlaceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gbpLocationName: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12, nullable: true })
  reviewCode: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80, nullable: true })
  slug: string | null;

  @Column({ type: 'varchar', length: 16, default: LocationMenuMode.FOOD })
  menuMode: LocationMenuMode;

  @Column({ type: 'varchar', length: 32, nullable: true })
  businessCategory: BusinessCategory | null;

  @Column({ type: 'json', default: () => "'[]'" })
  businessSubcategories: string[];

  @Column({ type: 'varchar', length: 16, nullable: true })
  catalogType: CatalogType | null;

  @Column({ type: 'datetime', nullable: true })
  quickCommerceSetupAt: Date | null;

  @Column({ type: 'int', default: 0 })
  scanCount: number;

  @Column({ type: 'datetime', nullable: true })
  metricsRefreshedAt: Date | null;

  @Column({ type: 'varchar', length: 16, default: LocationStatus.ACTIVE })
  status: LocationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
