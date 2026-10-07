import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Subscription lock (Phase 5)', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedOwnerWithLocation() {
    const email = `sub-${Date.now()}@example.com`;
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
    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${location.body.data.id}/quickreview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return {
      token,
      locationId: location.body.data.id as string,
      code: hub.body.data.reviewCode as string,
    };
  }

  async function activateTrial(token: string, locationId: string) {
    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const trial = plans.body.data.find((row: { code: string }) => row.code === 'quickreview_trial');
    expect(trial).toBeDefined();
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: trial.id })
      .expect(201);
  }

  it('locks public review until QuickReview is active', async () => {
    const { token, locationId, code } = await verifiedOwnerWithLocation();

    await request(app.getHttpServer()).get(`/api/public/r/${code}`).expect(402);

    const hubBefore = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickreview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hubBefore.body.data.reviewUnlocked).toBe(false);

    await activateTrial(token, locationId);

    await request(app.getHttpServer()).get(`/api/public/r/${code}`).expect(200);

    const hubAfter = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickreview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hubAfter.body.data.reviewUnlocked).toBe(true);
  });

  it('creates pending payment for paid plan checkout', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
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
      .send({ planId: monthly.id, provider: 'UPI' })
      .expect(201);
    expect(checkout.body.data.status).toBe('PENDING_PAYMENT');
    expect(checkout.body.data.paymentId).toBeTruthy();

    const billing = await request(app.getHttpServer())
      .get(`/api/billing/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(billing.body.data.products.quickReview.status).toBe('PENDING_PAYMENT');
  });
});
