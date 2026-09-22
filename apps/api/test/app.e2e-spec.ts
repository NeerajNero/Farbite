import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

// Must match vitest.config.e2e.ts test.env — ConfigModule validates at import time.
const TEST_KEY = 'test-internal-key-0123456789';

describe('Phase 0 API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
  });

  it('GET /health is public and reports db status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ ok: true, db: false });
  });

  it('GET /v1/ping without internal key → 401 with error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/ping').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /v1/ping with wrong internal key → 401', () => {
    return request(app.getHttpServer())
      .get('/v1/ping')
      .set('X-Internal-Key', 'wrong-key-wrong-key-wrong')
      .expect(401);
  });

  it('GET /v1/ping with valid key → guest actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/ping')
      .set('X-Internal-Key', TEST_KEY)
      .expect(200);
    expect(res.body).toEqual({ pong: true, actor: { type: 'guest' } });
  });

  it('GET /v1/ping with identity headers → user actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/ping')
      .set('X-Internal-Key', TEST_KEY)
      .set('X-Actor-Type', 'user')
      .set('X-User-Id', 'u-1')
      .set('X-User-Email', 'Founder@Example.com')
      .expect(200);
    expect(res.body.actor).toEqual({ type: 'user', userId: 'u-1', email: 'founder@example.com' });
  });

  afterEach(async () => {
    await app.close();
  });
});
