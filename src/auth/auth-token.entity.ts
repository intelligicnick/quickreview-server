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
import { User } from '../users/user.entity';
import { AuthTokenType } from './auth-token-type.enum';

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, (user) => user.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  type: AuthTokenType;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId(): void {
    if (!this.id) this.id = newId();
  }
}
