import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from '../locations/location.entity';
import {
  RevisitCustomerNameMode,
  RevisitLoyaltyScope,
  RevisitVisitFrequency,
} from './revisit.enums';

@Entity('location_revisit_settings')
export class LocationRevisitSettings {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  locationId: string;

  @OneToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 24, default: RevisitVisitFrequency.ONCE_PER_DAY })
  visitFrequency: RevisitVisitFrequency;

  @Column({ type: 'int', default: 24 })
  visitFrequencyHours: number;

  @Column({ type: 'varchar', length: 24, default: RevisitLoyaltyScope.BUSINESS_WIDE })
  loyaltyScope: RevisitLoyaltyScope;

  @Column({ type: 'varchar', length: 16, default: RevisitCustomerNameMode.OPTIONAL })
  customerNameMode: RevisitCustomerNameMode;

  @Column({ type: 'boolean', default: false })
  otpEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
