import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Super admin', () => {
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

  async function verifiedUser(prefix: string) {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: prefix, email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    return {
      email,
      token: res.body.data.accessToken as string,
      userId: res.body.data.user.id as string,
    };
  }

  async function superAdmin(prefix: string) {
    const account = await verifiedUser(prefix);
    await users.update({ id: account.userId }, { isSuperAdmin: true });
    return account;
  }

  it('hides the desk from a normal account', async () => {
    const merchant = await verifiedUser('merchant');
    const denied = await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${merchant.token}`)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(denied.body)).not.toContain('passwordHash');
  });

  it('lists users, disables an account, and refuses to disable itself', async () => {
    const admin = await superAdmin('owner');
    const merchant = await verifiedUser('shop');

    const list = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .query({ q: merchant.email })
      .expect(200);
    expect(list.body.data.some((row: { email: string }) => row.email === merchant.email)).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${merchant.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: merchant.email, password: 'Password1' })
      .expect(401);

    const self = await request(app.getHttpServer())
      .patch(`/api/admin/users/${admin.userId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false })
      .expect(400);
    expect(self.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('opens a merchant panel and returns to the super admin session', async () => {
    const admin = await superAdmin('desk');
    const merchant = await verifiedUser('panel');
    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ name: 'Panel Shop' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${merchant.token}`)
      .send({ name: 'Counter' })
      .expect(201);

    const minted = await request(app.getHttpServer())
      .post(`/api/admin/users/${merchant.userId}/login-as`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    expect(minted.body.data.expiresInSeconds).toBe(60);

    const agent = request.agent(app.getHttpServer());
    const session = await agent
      .post('/api/auth/login-as')
      .send({ token: minted.body.data.ticket })
      .expect(200);
    expect(session.body.data.user.id).toBe(merchant.userId);
    expect(session.body.data.user.isSuperAdmin).toBe(false);

    await agent.post('/api/auth/login-as').send({ token: minted.body.data.ticket }).expect(401);

    const mine = await agent
      .get('/api/businesses')
      .set('Authorization', `Bearer ${session.body.data.accessToken}`)
      .expect(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].name).toBe('Panel Shop');

    const resumed = await agent
      .post('/api/auth/resume-admin')
      .send({ token: minted.body.data.resumeToken })
      .expect(200);
    expect(resumed.body.data.user.id).toBe(admin.userId);
    expect(resumed.body.data.user.isSuperAdmin).toBe(true);

    await agent
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${resumed.body.data.accessToken}`)
      .expect(200);
    await agent.post('/api/auth/resume-admin').send({ token: minted.body.data.resumeToken }).expect(401);
  });

  it('transfers a business to another account', async () => {
    const admin = await superAdmin('transfer');
    const seller = await verifiedUser('seller');
    const buyer = await verifiedUser('buyer');
    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ name: 'Sold Shop' })
      .expect(201);
    const businessId = business.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/businesses/${businessId}/locations`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ name: 'Front' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/businesses/${businessId}/transfer`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ email: buyer.email })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/businesses/${businessId}`)
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(404);

    const owned = await request(app.getHttpServer())
      .get('/api/businesses')
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);
    expect(owned.body.data.some((row: { id: string }) => row.id === businessId)).toBe(true);
  });
});
