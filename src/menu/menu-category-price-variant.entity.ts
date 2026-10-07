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
import { MenuCategory } from './menu-category.entity';
import { MenuItemVariantPrice } from './menu-item-variant-price.entity';

@Entity('menu_category_price_variants')
export class MenuCategoryPriceVariant {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  categoryId: string;

  @ManyToOne(() => MenuCategory, (category) => category.priceVariants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => MenuItemVariantPrice, (row) => row.variant)
  itemPrices: MenuItemVariantPrice[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
