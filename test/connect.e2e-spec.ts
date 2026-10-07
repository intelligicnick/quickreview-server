import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('QuickConnect (Phase 7)', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedOwnerWithLocation() {
    const email = `connect-${Date.now()}@example.com`;
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
      .send({ name: 'Studio' })
      .expect(201);
    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Front Desk' })
      .expect(201);
    return {
      token,
      locationId: location.body.data.id as string,
    };
  }

  async function activateConnectTrial(token: string, locationId: string) {
    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const trial = plans.body.data.find(
      (row: { code: string }) => row.code === 'quickconnect_trial',
    );
    expect(trial).toBeDefined();
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: trial.id })
      .expect(201);
  }

  it('locks public card until QuickConnect is active', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickconnect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const slug = hub.body.data.slug as string;
    expect(hub.body.data.connectUnlocked).toBe(false);

    await request(app.getHttpServer()).get(`/api/public/c/${slug}`).expect(402);

    await activateConnectTrial(token, locationId);

    const publicCard = await request(app.getHttpServer())
      .get(`/api/public/c/${slug}`)
      .expect(200);
    expect(publicCard.body.data.displayName).toBe('Front Desk');

    const lead = await request(app.getHttpServer())
      .post(`/api/public/c/${slug}/leads`)
      .send({ name: 'Alex', phone: '+919876543210', note: 'Call me' })
      .expect(201);
    expect(lead.body.data.id).toBeTruthy();

    const leads = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickconnect/leads`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(leads.body.data).toHaveLength(1);
    expect(leads.body.data[0].name).toBe('Alex');
  });

  it('creates and deletes custom links', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    await activateConnectTrial(token, locationId);

    const created = await request(app.getHttpServer())
      .post(`/api/locations/${locationId}/quickconnect/links`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'WEBSITE',
        label: 'Portfolio',
        url: 'https://example.com/portfolio',
      })
      .expect(201);
    const linkId = created.body.data.id as string;

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickconnect`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hub.body.data.links).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/locations/${locationId}/quickconnect/links/${linkId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
