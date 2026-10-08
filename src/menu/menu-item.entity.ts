import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { Location } from '../locations/location.entity';
import { MenuCategory } from './menu-category.entity';
import { MenuItemPriceOption } from './menu-item-price-option.entity';
import { MenuItemVariantPrice } from './menu-item-variant-price.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  categoryId: string;

  @ManyToOne(() => MenuCategory, (category) => category.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'double', nullable: true })
  priceInr: number | null;

  @Column({ type: 'boolean', default: false })
  isNonVeg: boolean;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  /** Up to 2 entries: `local:0` / `local:1` for uploads, or https URLs. */
  @Column({ type: 'json', default: () => "'[]'" })
  imageUrls: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => MenuItemVariantPrice, (row) => row.item)
  variantPrices: MenuItemVariantPrice[];

  @OneToMany(() => MenuItemPriceOption, (row) => row.item)
  priceOptions: MenuItemPriceOption[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
