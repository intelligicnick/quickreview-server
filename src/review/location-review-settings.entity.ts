import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from '../locations/location.entity';

@Entity('location_review_settings')
export class LocationReviewSettings {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  locationId: string;

  @OneToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  keywords: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
