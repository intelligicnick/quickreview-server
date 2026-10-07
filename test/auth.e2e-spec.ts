import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { User } from '../src/users/user.entity';
import { createTestApp } from './create-test-app';
import { MemoryMailService } from './memory-mail.service';

describe('Auth', () => {
  let app: INestApplication;
  let mail: MemoryMailService;

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  const register = (overrides?: Record<string, string>) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Ada Owner',
        email: `ada-${Date.now()}@example.com`,
        password: 'Password1',
        ...overrides,
      });

  it('GET /api/health is public', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('rejects unauthorized API access', async () => {
    const res = await request(app.getHttpServer()).get('/api/businesses').expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('registers, returns access token, and exposes /me', async () => {
    const email = `reg-${Date.now()}@example.com`;
    const res = await register({ email }).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.emailVerified).toBe(false);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data.email).toBe(email);
  });

  it('rejects weak passwords and invalid email', async () => {
    await register({ email: 'not-an-email', password: 'Password1' }).expect(400);
    await register({
      email: `weak-${Date.now()}@example.com`,
      password: 'short1',
    }).expect(400);
    await register({
      email: `letters-${Date.now()}@example.com`,
      password: 'Password',
    }).expect(400);
  });

  it('rejects duplicate registration', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await register({ email }).expect(201);
    const res = await register({ email }).expect(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const email = `login-${Date.now()}@example.com`;
    await register({ email, password: 'Password1' }).expect(201);

    const ok = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password1' })
      .expect(200);
    expect(ok.body.data.accessToken).toBeTruthy();

    const bad = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass1' })
      .expect(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks disabled users from login and API use', async () => {
    const email = `off-${Date.now()}@example.com`;
    const created = await register({ email }).expect(201);
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const user = await users.findOneByOrFail({ email });
    user.isActive = false;
    await users.save(user);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password1' })
      .expect(401);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${created.body.data.accessToken}`)
      .expect(401);
    expect(me.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('verifies email with the mailed token', async () => {
    const email = `verify-${Date.now()}@example.com`;
    await register({ email }).expect(201);
    const token = mail.extractToken();
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(200);
    expect(res.body.data.emailVerified).toBe(true);
  });

  it('rejects expired or invalid verification tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: 'a'.repeat(32) })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('resets a password and revokes old sessions', async () => {
    const email = `reset-${Date.now()}@example.com`;
    const created = await register({ email }).expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);
    const resetToken = mail.extractToken();

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'NewPass99' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Password1' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'NewPass99' })
      .expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', created.headers['set-cookie'] ?? [])
      .expect(401);
    expect(refresh.body.success).toBe(false);
  });

  it('forgot-password does not reveal whether an email exists', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    expect(res.body.data.sent).toBe(true);
  });

  it('logs out and rejects the refresh cookie', async () => {
    const email = `out-${Date.now()}@example.com`;
    const created = await register({ email }).expect(201);
    const cookies = created.headers['set-cookie'] ?? [];

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${created.body.data.accessToken}`)
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .expect(401);
  });
});
