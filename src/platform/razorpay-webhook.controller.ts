import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common/interfaces';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RazorpayService } from './razorpay.service';
import { SubscriptionsService } from './subscriptions.service';

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

@Controller('billing/razorpay')
export class RazorpayWebhookController {
  constructor(
    private readonly razorpay: RazorpayService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!this.razorpay.verifyWebhookSignature(raw, signature)) {
      return { ignored: true };
    }

    let payload: RazorpayWebhook;
    try {
      payload = JSON.parse(raw.toString('utf8')) as RazorpayWebhook;
    } catch {
      return { ignored: true };
    }

    const event = payload.event ?? '';
    if (event !== 'payment.captured' && event !== 'order.paid') {
      return { received: true };
    }

    const orderId =
      payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id ?? null;
    if (!orderId) return { received: true };

    const payment = await this.subscriptions.findPendingPaymentByRazorpayOrder(orderId);
    if (!payment) return { received: true };

    await this.subscriptions.confirmPaymentSuccess(payment.id, `razorpay:${orderId}`);
    return { activated: true, paymentId: payment.id };
  }
}
