import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Counter sale', () => {
  let app: INestApplication;
  let mail: MemoryMailService;
  let users: Repository<User>;

  beforeAll(async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'mock';
    ({ app, mail } = await createTestApp());
    users = app.get(getRepositoryToken(User));
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function superAdmin() {
    const email = `cs-admin-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Admin', email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    await users.update({ id: reg.body.data.user.id }, { isSuperAdmin: true });
    process.env.COUNTER_SALE_OWNER_EMAIL = email;
    return { email, token: reg.body.data.accessToken as string };
  }

  async function printedQr(adminToken: string) {
    const batch = await request(app.getHttpServer())
      .post('/api/admin/qr-codes/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ size: 1 })
      .expect(201);
    const code = batch.body.data.codes[0] as string;
    const list = await request(app.getHttpServer())
      .get('/api/admin/qr-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const row = (list.body.data as { id: string; code: string }[]).find((item) => item.code === code)!;
    await request(app.getHttpServer())
      .patch(`/api/admin/qr-codes/${row.id}/printed`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPrinted: true })
      .expect(200);
    return code;
  }

  it('agent login, provision, list, and transfer', async () => {
    const { email: holdingEmail, token: adminToken } = await superAdmin();

    const created = await request(app.getHttpServer())
      .post('/api/admin/counter-sale/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'field1', pin: '12345' })
      .expect(201);
    const agentId = created.body.data.id as string;

    const agents = await request(app.getHttpServer())
      .get('/api/admin/counter-sale/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(agents.body.data.some((row: { id: string }) => row.id === agentId)).toBe(true);

    const session = await request(app.getHttpServer())
      .post(`/api/admin/counter-sale/agents/${agentId}/session`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(session.body.data.accessToken).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/api/counter-sale/auth/login')
      .send({ username: 'field1', pin: '12345' })
      .expect(200);
    const agentToken = login.body.data.accessToken as string;

    const code = await printedQr(adminToken);

    const ready = await request(app.getHttpServer())
      .get(`/api/counter-sale/qr-codes/lookup?code=${code}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(ready.body.data.status).toBe('ready');

    const provision = await request(app.getHttpServer())
      .post('/api/counter-sale/provisions')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        qrCode: code,
        placeId: 'ChIJMOCKPATEL001',
        service: 'review',
      })
      .expect(201);
    const assigned = await request(app.getHttpServer())
      .get(`/api/counter-sale/qr-codes/lookup?code=${code}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(assigned.body.data.status).toBe('assigned');

    expect(provision.body.data.targetUrl).toContain('/r/');
    expect(provision.body.data.location.googlePlaceId).toBe('ChIJMOCKPATEL001');

    const list = await request(app.getHttpServer())
      .get('/api/admin/counter-sale/provisions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);
    const row = list.body.data.find((item: { qrCode: string }) => item.qrCode === code);
    expect(row.business.onHoldingAccount).toBe(true);

    const merchantEmail = `merchant-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Merchant', email: merchantEmail, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/admin/businesses/${row.business.id}/transfer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: merchantEmail })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/admin/counter-sale/provisions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const transferred = after.body.data.find((item: { qrCode: string }) => item.qrCode === code);
    expect(transferred.business.onHoldingAccount).toBe(false);

    expect(holdingEmail).toBeTruthy();
  });
});
