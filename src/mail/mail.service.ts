import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, text: string): Promise<void> {
    const mode = (this.config.get<string>('EMAIL_MODE') ?? 'log').toLowerCase();
    if (mode === 'log') {
      this.logger.log(`[mail] to=${to} subject=${subject}\n${text}`);
      return;
    }
    if (mode === 'brevo') {
      await this.sendBrevo(to, subject, text);
      return;
    }
    this.logger.warn(`EMAIL_MODE=${mode} is not supported; logging instead`);
    this.logger.log(`[mail] to=${to} subject=${subject}\n${text}`);
  }

  private async sendBrevo(to: string, subject: string, text: string): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is required when EMAIL_MODE=brevo');
    }
    const fromEmail = this.config.get<string>('EMAIL_FROM') ?? 'noreply@quickreview.app';
    const fromName = this.config.get<string>('EMAIL_FROM_NAME') ?? 'QuickReview';

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Brevo send failed (${response.status}): ${body}`);
      throw new Error('Could not send email');
    }
  }

  verificationMessage(appUrl: string, token: string): string {
    return [
      'Verify your QuickReview email using this link:',
      `${appUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`,
      '',
      'This link expires in 24 hours.',
    ].join('\n');
  }

  resetMessage(appUrl: string, token: string): string {
    return [
      'Reset your QuickReview password using this link:',
      `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`,
      '',
      'This link expires in 1 hour. If you did not request it, ignore this email.',
    ].join('\n');
  }
}
