import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

const WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
const nativeFetch = global.fetch.bind(global);

describe('Razorpay webhook', () => {
  let app: INestApplication;
  let mail: MemoryMailService;
  const orderId = 'order_e2e_test_001';
  beforeAll(async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    global.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes('api.razorpay.com/v1/orders')) {
        return new Response(
          JSON.stringify({ id: orderId, amount: 49900, currency: 'INR' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return nativeFetch(input, init);
    };

    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    global.fetch = nativeFetch;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    await app?.close();
  });

  async function ownerWithPaidCheckout() {
    const email = `rzp-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Owner', email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    const token = reg.body.data.accessToken as string;
    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Shop' })
      .expect(201);
    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Branch' })
      .expect(201);
    const locationId = location.body.data.id as string;

    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const monthly = plans.body.data.find(
      (row: { code: string }) => row.code === 'quickreview_monthly',
    );
    const checkout = await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: monthly.id, provider: 'RAZORPAY' })
      .expect(201);

    expect(checkout.body.data.razorpay?.orderId).toBe(orderId);
    return { token, locationId };
  }

  function signWebhookBody(body: string): string {
    return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  }

  it(
    'activates subscription on payment.captured with valid signature',
    async () => {
    const { token, locationId } = await ownerWithPaidCheckout();

    const billingBefore = await request(app.getHttpServer())
      .get(`/api/billing/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(billingBefore.body.data.products.quickReview.status).toBe('PENDING_PAYMENT');

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: orderId } } },
    });
    const signature = signWebhookBody(payload);

    const webhook = await request(app.getHttpServer())
      .post('/api/billing/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(payload)
      .expect(200);

    expect(webhook.body.data.activated).toBe(true);

    const billingAfter = await request(app.getHttpServer())
      .get(`/api/billing/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(billingAfter.body.data.products.quickReview.status).toBe('ACTIVE');
    },
    30000,
  );

  it('ignores webhook with invalid signature', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: orderId } } },
    });

    const res = await request(app.getHttpServer())
      .post('/api/billing/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .send(payload)
      .expect(200);

    expect(res.body.data.ignored).toBe(true);
  });
});
