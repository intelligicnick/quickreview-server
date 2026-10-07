import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Polish — QR claim & AI drafts', () => {
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

  async function ownerWithLocation() {
    const email = `polish-${Date.now()}@example.com`;
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
      .send({ name: 'Front' })
      .expect(201);
    return { token, locationId: location.body.data.id as string };
  }

  async function activateReviewTrial(token: string, locationId: string) {
    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const trial = plans.body.data.find((row: { code: string }) => row.code === 'quickreview_trial');
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: trial.id })
      .expect(201);
  }

  async function superAdminToken() {
    const email = `admin-polish-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Admin', email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    await users.update({ id: reg.body.data.user.id }, { isSuperAdmin: true });
    return reg.body.data.accessToken as string;
  }

  it('resolves and claims a standee QR to review page', async () => {
    const adminToken = await superAdminToken();
    const { token, locationId } = await ownerWithLocation();

    const batch = await request(app.getHttpServer())
      .post('/api/admin/qr-codes/batches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ size: 1 })
      .expect(201);
    const code = batch.body.data.codes[0] as string;

    await request(app.getHttpServer()).get(`/api/public/q/${code}`).expect(200);

    const claim = await request(app.getHttpServer())
      .post(`/api/locations/${locationId}/qr-codes/claim`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code, kind: 'review' })
      .expect(201);
    expect(claim.body.data.targetUrl).toContain('/r/');
  });

  it('returns AI draft suggestions using saved keywords', async () => {
    const { token, locationId } = await ownerWithLocation();
    await activateReviewTrial(token, locationId);

    await request(app.getHttpServer())
      .patch(`/api/locations/${locationId}/quickreview/settings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ keywords: ['biryani', 'quick seating'] })
      .expect(200);

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickreview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const reviewCode = hub.body.data.reviewCode as string;

    const drafts = await request(app.getHttpServer())
      .post(`/api/public/r/${reviewCode}/suggestions`)
      .send({ stars: 5 })
      .expect(200);
    expect(drafts.body.data.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});
