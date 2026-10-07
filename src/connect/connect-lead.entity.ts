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
import { ConnectProfile } from './connect-profile.entity';

@Entity('connect_leads')
export class ConnectLead {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  connectProfileId: string;

  @ManyToOne(() => ConnectProfile, (profile) => profile.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectProfileId' })
  profile: ConnectProfile;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  phone: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
