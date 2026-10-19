import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { activateTrialPlan, superAdminToken } from './billing-test-helpers';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

const MONTHLY_CODES = [
  'quickreview_monthly',
  'quickmenu_monthly',
  'quickconnect_monthly',
  'quickdesign_monthly',
  'quickscan_monthly',
  'quickcrm_monthly',
] as const;

describe('Billing bundle checkout', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedOwnerWithLocation() {
    const email = `bundle-${Date.now()}@example.com`;
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
    return { token, locationId: location.body.data.id as string };
  }

  async function planByCode(token: string, code: string) {
    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const row = plans.body.data.find((p: { code: string }) => p.code === code);
    if (!row) throw new Error(`Plan ${code} missing`);
    return row as { id: string; amountInr: number; product: string };
  }

  it('rejects checkout when product already has an active plan', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    await activateTrialPlan(app, mail, token, locationId, 'quickreview_trial');
    const monthly = await planByCode(token, 'quickreview_monthly');
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: monthly.id, provider: 'UPI' })
      .expect(400);
  });

  it('rejects two plans for the same product in one checkout', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    const trial = await planByCode(token, 'quickreview_trial');
    const monthly = await planByCode(token, 'quickreview_monthly');
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planIds: [trial.id, monthly.id], provider: 'UPI' })
      .expect(400);
  });

  it('bundles two products into one payment at list price sum', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    const review = await planByCode(token, 'quickreview_monthly');
    const menu = await planByCode(token, 'quickmenu_monthly');
    const checkout = await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planIds: [review.id, menu.id], provider: 'UPI' })
      .expect(201);
    expect(checkout.body.data.totalInr).toBe(review.amountInr + menu.amountInr);
    expect(checkout.body.data.discountInr).toBe(0);
    expect(checkout.body.data.subscriptionIds).toHaveLength(2);

    const billing = await request(app.getHttpServer())
      .get(`/api/billing/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(billing.body.data.products.quickReview.status).toBe('PENDING_PAYMENT');
    expect(billing.body.data.products.quickMenu.status).toBe('PENDING_PAYMENT');
  });

  it('applies 30% off for all six products and activates on mark-paid', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    const plans = await Promise.all(MONTHLY_CODES.map((code) => planByCode(token, code)));
    const subtotal = plans.reduce((sum, p) => sum + p.amountInr, 0);
    const expectedTotal = Math.round(subtotal * 0.7);

    const checkout = await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planIds: plans.map((p) => p.id), provider: 'CASH' })
      .expect(201);
    expect(checkout.body.data.subtotalInr).toBe(subtotal);
    expect(checkout.body.data.totalInr).toBe(expectedTotal);
    expect(checkout.body.data.discountInr).toBe(subtotal - expectedTotal);
    expect(checkout.body.data.lineItems).toHaveLength(6);

    const paymentId = checkout.body.data.paymentId as string;
    const adminToken = await superAdminToken(app, mail);
    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: '123456789012' })
      .expect(201);

    const billing = await request(app.getHttpServer())
      .get(`/api/billing/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const products = billing.body.data.products;
    expect(products.quickReview.unlocked).toBe(true);
    expect(products.quickMenu.unlocked).toBe(true);
    expect(products.quickConnect.unlocked).toBe(true);
    expect(products.quickDesign.unlocked).toBe(true);
    expect(products.quickScan.unlocked).toBe(true);
    expect(products.quickCrm.unlocked).toBe(true);
  });
});
