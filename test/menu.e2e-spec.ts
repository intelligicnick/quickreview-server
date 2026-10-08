import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('QuickMenu (Phase 8)', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedOwnerWithLocation() {
    const email = `menu-${Date.now()}@example.com`;
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
      .send({ name: 'Main Street', menuMode: 'FOOD' })
      .expect(201);
    return {
      token,
      locationId: location.body.data.id as string,
    };
  }

  async function activateMenuTrial(token: string, locationId: string) {
    const plans = await request(app.getHttpServer())
      .get('/api/billing/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const trial = plans.body.data.find((row: { code: string }) => row.code === 'quickmenu_trial');
    expect(trial).toBeDefined();
    await request(app.getHttpServer())
      .post(`/api/billing/locations/${locationId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: trial.id })
      .expect(201);
  }

  it('locks public menu until QuickMenu is active', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();

    const hub = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickmenu`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const slug = hub.body.data.slug as string;
    expect(hub.body.data.menuUnlocked).toBe(false);
    expect(hub.body.data.copy.pageTitle).toBe('Menu');

    await request(app.getHttpServer()).get(`/api/public/menu/${slug}`).expect(402);

    await activateMenuTrial(token, locationId);

    const category = await request(app.getHttpServer())
      .post(`/api/locations/${locationId}/quickmenu/categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Starters' })
      .expect(201);

    const variants = category.body.data.priceVariants as { id: string }[];
    await request(app.getHttpServer())
      .post(`/api/locations/${locationId}/quickmenu/categories/${category.body.data.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Soup',
        priceInr: 120,
        isNonVeg: false,
        variantPrices: variants.map((v) => ({ variantId: v.id, priceInr: 120 })),
      })
      .expect(201);

    const publicMenu = await request(app.getHttpServer())
      .get(`/api/public/menu/${slug}`)
      .expect(200);
    expect(publicMenu.body.data.categories).toHaveLength(1);
    expect(publicMenu.body.data.categories[0].items[0].name).toBe('Soup');

    const hubAfter = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}/quickmenu`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(hubAfter.body.data.publicPath).toBe(`/go/${slug}`);
    const publicHub = await request(app.getHttpServer()).get(`/api/public/go/${slug}`).expect(200);
    expect(publicHub.body.data.menu?.path).toBe(`/menu/${slug}`);
    expect(publicHub.body.data.revisit).toBeNull();
  });

  it('switches copy when menu mode is SERVICES', async () => {
    const { token, locationId } = await verifiedOwnerWithLocation();
    const updated = await request(app.getHttpServer())
      .patch(`/api/locations/${locationId}/quickmenu`)
      .set('Authorization', `Bearer ${token}`)
      .send({ menuMode: 'SERVICES' })
      .expect(200);
    expect(updated.body.data.copy.pageTitle).toBe('Services');
  });
});
