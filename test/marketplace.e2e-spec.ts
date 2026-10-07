import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Marketplace (Phase 9)', () => {
  let app: INestApplication;
  let mail: MemoryMailService;
  let users: Repository<User>;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
    users = app.get(getRepositoryToken(User));
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedOwnerWithLocation() {
    const email = `mkt-${Date.now()}@example.com`;
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
      .send({ name: 'Print Shop' })
      .expect(201);
    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Counter' })
      .expect(201);
    return {
      token,
      locationId: location.body.data.id as string,
    };
  }

  async function superAdminToken() {
    const email = `admin-mkt-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Admin', email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    const userId = reg.body.data.user.id as string;
    await users.update({ id: userId }, { isSuperAdmin: true });
    return reg.body.data.accessToken as string;
  }

  it('lists catalog, places order, and confirms payment via admin', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    const adminToken = await superAdminToken();

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/marketplace`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hub.body.data.products.length).toBeGreaterThan(0);
    const productId = hub.body.data.products[0].id as string;

    const placed = await request(app.getHttpServer())
      .post(`/api/locations/${locationId}/marketplace/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        phoneNumber: '+919876543210',
        quantity: 1,
        provider: 'UPI',
      })
      .expect(201);
    const paymentId = placed.body.data.paymentId as string;
    expect(placed.body.data.order.status).toBe('PLACED');
    expect(paymentId).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/admin/payments/${paymentId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'test' })
      .expect(201);

    const hubAfter = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/marketplace`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hubAfter.body.data.orders[0].status).toBe('CONFIRMED');
    expect(hubAfter.body.data.orders[0].pendingPaymentId).toBeNull();

    const adminOrders = await request(app.getHttpServer())
      .get('/api/admin/marketplace/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminOrders.body.data.some((row: { id: string }) => row.id === placed.body.data.order.id)).toBe(
      true,
    );
  });
});
