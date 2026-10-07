import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
};

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('RAZORPAY_KEY_ID') && this.config.get<string>('RAZORPAY_KEY_SECRET'));
  }

  publicKeyId(): string {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    if (!keyId) throw new Error('RAZORPAY_KEY_ID is not configured');
    return keyId;
  }

  orderReference(orderId: string): string {
    return `rzp_order:${orderId}`;
  }

  parseOrderReference(note: string | null): string | null {
    if (!note?.startsWith('rzp_order:')) return null;
    return note.slice('rzp_order:'.length);
  }

  async createOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new Error('Razorpay is not configured');
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt.slice(0, 40),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Razorpay order failed (${response.status}): ${body}`);
      throw new Error('Could not create Razorpay order');
    }

    const payload = (await response.json()) as { id: string; amount: number; currency: string };
    return { id: payload.id, amount: payload.amount, currency: payload.currency };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET missing — rejecting webhook');
      return false;
    }
    if (!signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
