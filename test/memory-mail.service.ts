import { Injectable } from '@nestjs/common';
import { MailService } from '../src/mail/mail.service';

@Injectable()
export class MemoryMailService extends MailService {
  last: { to: string; subject: string; text: string } | null = null;

  constructor() {
    super({ get: () => 'log' } as never);
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    this.last = { to, subject, text };
  }

  extractToken(): string {
    const match = this.last?.text.match(/token=([a-f0-9]+)/);
    if (!match) {
      throw new Error('No token found in last email');
    }
    return match[1];
  }
}
