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
import { newId } from '../common/utils/crypto';
import { MenuItem } from './menu-item.entity';

/** Product-specific size/portion option (QuickCommerce — not shared across a category). */
@Entity('menu_item_price_options')
export class MenuItemPriceOption {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  itemId: string;

  @ManyToOne(() => MenuItem, (item) => item.priceOptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: MenuItem;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

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
