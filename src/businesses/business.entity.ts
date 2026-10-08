import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { newId } from '../common/utils/crypto';
import { Location } from '../locations/location.entity';
import { BusinessMember } from '../members/business-member.entity';

@Entity('businesses')
export class Business {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  googleReviewUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  onboardingCompletedAt: Date | null;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  ownerUserId: string;

  @OneToMany(() => Location, (location) => location.business)
  locations: Location[];

  @OneToMany(() => BusinessMember, (member) => member.business)
  members: BusinessMember[];

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
