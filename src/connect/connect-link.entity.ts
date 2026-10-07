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
import { ConnectLinkType } from './connect-link-type.enum';
import { ConnectProfile } from './connect-profile.entity';

@Entity('connect_links')
export class ConnectLink {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  connectProfileId: string;

  @ManyToOne(() => ConnectProfile, (profile) => profile.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectProfileId' })
  profile: ConnectProfile;

  @Column({ type: 'varchar', length: 16, default: ConnectLinkType.OTHER })
  type: ConnectLinkType;

  @Column({ type: 'varchar', length: 80 })
  label: string;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
