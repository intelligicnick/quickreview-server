import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Public QuickReview', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function ownerWithLocation() {
    const email = `review-${Date.now()}@example.com`;
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
      .send({ name: 'Cafe' })
      .expect(201);
    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Main',
        googleReviewUrl:
          'https://search.google.com/local/writereview?placeid=ChIJTESTPLACEID123',
      })
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

  it('serves the public page and records private vs google paths', async () => {
    const { token, locationId, code } = await ownerWithLocation();
    await activateTrial(token, locationId);

    const page = await request(app.getHttpServer()).get(`/api/public/r/${code}`).expect(200);
    expect(page.body.data.name).toBe('Main');
    expect(page.body.data.googlePlaceId).toBe('ChIJTESTPLACEID123');

    await request(app.getHttpServer())
      .post(`/api/public/r/${code}/events`)
      .send({ type: 'star', stars: 2 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/public/r/${code}/events`)
      .send({ type: 'private', stars: 2, message: 'Wait was too long' })
      .expect(200);

    const inbox = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/inbox`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(inbox.body.data).toHaveLength(1);
    expect(inbox.body.data[0].message).toBe('Wait was too long');

    await request(app.getHttpServer())
      .post(`/api/public/r/${code}/events`)
      .send({ type: 'star', stars: 5 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/public/r/${code}/events`)
      .send({ type: 'google_open', stars: 5 })
      .expect(200);

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickreview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hub.body.data.stats.privateFeedback).toBe(1);
    expect(hub.body.data.stats.googleOpens).toBe(1);
    expect(hub.body.data.publicPath).toBe(`/r/${code}`);
  });
});
