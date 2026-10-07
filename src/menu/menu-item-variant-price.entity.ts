import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { MenuCategoryPriceVariant } from './menu-category-price-variant.entity';
import { MenuItem } from './menu-item.entity';

@Entity('menu_item_variant_prices')
@Unique(['itemId', 'variantId'])
export class MenuItemVariantPrice {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  itemId: string;

  @ManyToOne(() => MenuItem, (item) => item.variantPrices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: MenuItem;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  variantId: string;

  @ManyToOne(() => MenuCategoryPriceVariant, (variant) => variant.itemPrices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantId' })
  variant: MenuCategoryPriceVariant;

  @Column({ type: 'double precision' })
  priceInr: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
