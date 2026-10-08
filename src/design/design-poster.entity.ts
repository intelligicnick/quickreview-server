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
import type { DesignPictureMode, DesignTemplate } from './design.constants';

@Entity('design_posters')
@Index(['locationId', 'createdAt'])
export class DesignPoster {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 32 })
  template: DesignTemplate;

  @Column({ type: 'varchar', length: 16, default: 'photos' })
  pictureMode: DesignPictureMode;

  @Column({ type: 'text', nullable: true })
  prompt: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  offerText: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  festival: string | null;

  @Column({ type: 'varchar', length: 64, default: 'image/png' })
  mimeType: string;

  @Column({ type: 'blob' })
  imageData: Buffer;

  @Column({ type: 'varchar', length: 8, default: '9:16' })
  aspectRatio: string;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
