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
import { ConnectLead } from './connect-lead.entity';
import { ConnectLink } from './connect-link.entity';

@Entity('connect_profiles')
export class ConnectProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  displayName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  designation: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  whatsappPhone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  profileImageUrl: string | null;

  @OneToMany(() => ConnectLink, (link) => link.profile)
  links: ConnectLink[];

  @OneToMany(() => ConnectLead, (lead) => lead.profile)
  leads: ConnectLead[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
