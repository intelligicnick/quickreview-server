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
import { Exclude } from 'class-transformer';
import { newId } from '../common/utils/crypto';
import { AuthToken } from '../auth/auth-token.entity';
import { BusinessMember } from '../members/business-member.entity';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Exclude()
  @Column({ type: 'varchar', length: 120 })
  passwordHash: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSuperAdmin: boolean;

  @OneToMany(() => BusinessMember, (member) => member.user)
  memberships: BusinessMember[];

  @OneToMany(() => AuthToken, (token) => token.user)
  tokens: AuthToken[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }

  get emailVerified(): boolean {
    return Boolean(this.emailVerifiedAt);
  }
}
