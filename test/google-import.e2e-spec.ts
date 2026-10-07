import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Google import (Phase 2)', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'mock';
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedUser() {
    const email = `google-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Importer', email, password: 'Password1' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: mail.extractToken() })
      .expect(200);
    return res.body.data.accessToken as string;
  }

  it('searches mock places', async () => {
    const token = await verifiedUser();
    const res = await request(app.getHttpServer())
      .post('/api/google/places/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'Patel' })
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].placeId).toBe('ChIJMOCKPATEL001');
  });

  it('imports a place into business + location', async () => {
    const token = await verifiedUser();
    const imported = await request(app.getHttpServer())
      .post('/api/google/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ placeId: 'ChIJMOCKPATEL001' }],
      })
      .expect(201);
    expect(imported.body.data.business.name).toBe('Patel Jewellers');
    expect(imported.body.data.locations).toHaveLength(1);
    expect(imported.body.data.locations[0].googlePlaceId).toBe('ChIJMOCKPATEL001');

    const duplicate = await request(app.getHttpServer())
      .post('/api/google/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ placeId: 'ChIJMOCKPATEL001' }],
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });
});
