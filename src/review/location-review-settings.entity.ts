import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { jsonStringArrayTransformer } from '../common/utils/json-string-array';
import { Location } from '../locations/location.entity';

@Entity('location_review_settings')
export class LocationReviewSettings {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  locationId: string;

  @OneToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'text', transformer: jsonStringArrayTransformer })
  keywords: string[];

  @Column({ type: 'text', nullable: true, transformer: jsonStringArrayTransformer })
  reviewQuestions: string[] | null;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  defaultKeywords(): void {
    if (this.keywords == null) this.keywords = [];
    if (this.reviewQuestions == null) this.reviewQuestions = [];
  }
}
