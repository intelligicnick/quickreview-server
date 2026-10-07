import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { BusinessMember } from '../src/members/business-member.entity';
import { MemberRole } from '../src/members/member-role.enum';
import { MemberStatus } from '../src/members/member-status.enum';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Tenant isolation', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  async function verifiedUser(prefix: string) {
    const email = `${prefix}-${Date.now()}@example.com`;
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

  it('blocks unverified users from creating a business', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Unverified',
        email: `unv-${Date.now()}@example.com`,
        password: 'Password1',
      })
      .expect(201);

    const denied = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .send({ name: 'Cafe' })
      .expect(403);
    expect(denied.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('creates a business and location for the owner', async () => {
    const owner = await verifiedUser('owner');
    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Harbor Cafe', category: 'Restaurant' })
      .expect(201);
    expect(business.body.data.name).toBe('Harbor Cafe');

    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Downtown' })
      .expect(201);
    expect(location.body.data.businessId).toBe(business.body.data.id);
  });

  it('prevents IDOR on businesses and locations', async () => {
    const alice = await verifiedUser('alice');
    const bob = await verifiedUser('bob');

    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Alice Shop' })
      .expect(201);
    const businessId = business.body.data.id as string;

    const location = await request(app.getHttpServer())
      .post(`/api/businesses/${businessId}/locations`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ name: 'Main' })
      .expect(201);
    const locationId = location.body.data.id as string;

    const stolenBiz = await request(app.getHttpServer())
      .get(`/api/businesses/${businessId}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(404);
    expect(stolenBiz.body.error.code).toBe('NOT_FOUND');

    const stolenList = await request(app.getHttpServer())
      .get(`/api/businesses/${businessId}/locations`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(404);

    expect(stolenList.body.error.code).toBe('NOT_FOUND');

    const stolenLoc = await request(app.getHttpServer())
      .get(`/api/locations/${locationId}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(404);
    expect(stolenLoc.body.error.code).toBe('NOT_FOUND');

    const stolenPatch = await request(app.getHttpServer())
      .patch(`/api/businesses/${businessId}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ name: 'Hacked' })
      .expect(404);
    expect(stolenPatch.body.error.code).toBe('NOT_FOUND');

    const list = await request(app.getHttpServer())
      .get('/api/businesses')
      .set('Authorization', `Bearer ${bob.token}`)
      .expect(200);
    expect(list.body.data).toEqual([]);
  });

  it('rejects invalid UUIDs', async () => {
    const owner = await verifiedUser('ids');
    await request(app.getHttpServer())
      .get('/api/businesses/not-a-uuid')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/locations/123')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(400);
  });

  it('rejects unknown IDs as not found', async () => {
    const owner = await verifiedUser('missing');
    await request(app.getHttpServer())
      .get('/api/businesses/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);
  });

  it('prevents staff from creating locations', async () => {
    const owner = await verifiedUser('boss');
    const staff = await verifiedUser('staff');

    const business = await request(app.getHttpServer())
      .post('/api/businesses')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Staff Test' })
      .expect(201);

    const members = app.get<Repository<BusinessMember>>(
      getRepositoryToken(BusinessMember),
    );
    await members.save(
      members.create({
        businessId: business.body.data.id,
        userId: staff.userId,
        role: MemberRole.STAFF,
        status: MemberStatus.ACTIVE,
      }),
    );

    const denied = await request(app.getHttpServer())
      .post(`/api/businesses/${business.body.data.id}/locations`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ name: 'Should fail' })
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const allowedRead = await request(app.getHttpServer())
      .get(`/api/businesses/${business.body.data.id}`)
      .set('Authorization', `Bearer ${staff.token}`)
      .expect(200);
    expect(allowedRead.body.data.name).toBe('Staff Test');
  });

  it('does not create a user via an unscoped users endpoint', async () => {
    const owner = await verifiedUser('nousers');
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404);

    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const count = await users.count();
    expect(count).toBeGreaterThan(0);
  });
});
