import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { User } from '../src/users/user.entity';
import { MemoryMailService } from './memory-mail.service';

export async function superAdminToken(
  app: INestApplication,
  mail: MemoryMailService,
): Promise<string> {
  const email = `admin-e2e-${Date.now()}@example.com`;
  const reg = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name: 'Admin', email, password: 'Password1' })
    .expect(201);
  await request(app.getHttpServer())
    .post('/api/auth/verify-email')
    .send({ token: mail.extractToken() })
    .expect(200);
  const users = app.get<import('typeorm').Repository<User>>(getRepositoryToken(User));
  await users.update({ id: reg.body.data.user.id }, { isSuperAdmin: true });
  return reg.body.data.accessToken as string;
}

/** Paid intro trial: UPI checkout + admin marks payment received. */
export async function activateTrialPlan(
  app: INestApplication,
  mail: MemoryMailService,
  ownerToken: string,
  locationId: string,
  planCode: string,
): Promise<void> {
  const plans = await request(app.getHttpServer())
    .get('/api/billing/plans')
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  const trial = plans.body.data.find((row: { code: string }) => row.code === planCode);
  if (!trial) throw new Error(`Plan ${planCode} not found`);
  const checkout = await request(app.getHttpServer())
    .post(`/api/billing/locations/${locationId}/checkout`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ planId: trial.id, provider: 'CASH' })
    .expect(201);
  const paymentId = checkout.body.data.paymentId as string;
  const adminToken = await superAdminToken(app, mail);
  await request(app.getHttpServer())
    .post(`/api/admin/payments/${paymentId}/mark-paid`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ note: 'e2e' })
    .expect(201);
}
