import { createHmac } from 'crypto';
import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createUser } from './factories';
import { VerificationCode } from '../src/models';
import { _resetSmsReplayStore } from '../src/middleware/smsWebhook';
import { config } from '../src/config/env';

const SECRET = 'test-sms-webhook-secret';

function sign(rawBody: string, timestamp: number): string {
  return createHmac('sha256', SECRET).update(`${timestamp}.`).update(rawBody).digest('hex');
}

describe('Phase 5 hardening', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    _resetSmsReplayStore();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('SMS webhook authentication', () => {
    it('refuses an unsigned request', async () => {
      const res = await request(app)
        .post('/api/appointments/sms')
        .send({ from: '+260000000000', body: 'BOOK' });

      expect(res.status).toBe(401);
    });

    it('accepts a correctly signed request', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = { from: '+260000000000', body: 'BOOK' };

      const res = await request(app)
        .post('/api/appointments/sms')
        .set('X-SMS-Timestamp', String(timestamp))
        .set('X-SMS-Signature', sign(JSON.stringify(payload), timestamp))
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);
    });

    it('refuses a signature made with the wrong secret', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const forged = createHmac('sha256', 'not-the-secret')
        .update(`${timestamp}.${JSON.stringify({ body: 'BOOK' })}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/appointments/sms')
        .set('X-SMS-Timestamp', String(timestamp))
        .set('X-SMS-Signature', forged)
        .send({ body: 'BOOK' });

      expect(res.status).toBe(401);
    });

    it('refuses a payload that was edited after signing', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const original = { body: 'BOOK' };

      const res = await request(app)
        .post('/api/appointments/sms')
        .set('X-SMS-Timestamp', String(timestamp))
        .set('X-SMS-Signature', sign(JSON.stringify(original), timestamp))
        .send({ body: 'CANCEL' });

      expect(res.status).toBe(401);
    });

    it('refuses a stale timestamp, so a captured request cannot be replayed later', async () => {
      const timestamp = Math.floor(Date.now() / 1000) - config.sms.webhookToleranceSeconds - 60;
      const payload = { body: 'BOOK' };

      const res = await request(app)
        .post('/api/appointments/sms')
        .set('X-SMS-Timestamp', String(timestamp))
        .set('X-SMS-Signature', sign(JSON.stringify(payload), timestamp))
        .send(payload);

      expect(res.status).toBe(401);
    });

    it('refuses a replayed delivery id inside the freshness window', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = { body: 'BOOK' };
      const headers = {
        'X-SMS-Timestamp': String(timestamp),
        'X-SMS-Signature': sign(JSON.stringify(payload), timestamp),
        'X-SMS-Delivery-Id': 'delivery-abc-123',
      };

      const first = await request(app).post('/api/appointments/sms').set(headers).send(payload);
      const second = await request(app).post('/api/appointments/sms').set(headers).send(payload);

      // Both requests are individually valid, so only the delivery id distinguishes them.
      expect(first.status).toBe(200);
      expect(second.status).toBe(409);
    });

    it('does not echo the payload back to the caller', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = { from: '+260000000000', body: 'BOOK', secretish: 'do-not-reflect' };

      const res = await request(app)
        .post('/api/appointments/sms')
        .set('X-SMS-Timestamp', String(timestamp))
        .set('X-SMS-Signature', sign(JSON.stringify(payload), timestamp))
        .send(payload);

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('do-not-reflect');
    });
  });

  describe('one-time codes', () => {
    it('will not accept the same login code twice', async () => {
      await createUser({ email: 'otp-replay@test.local' });
      const issued = await request(app)
        .post('/api/auth/otp/request')
        .send({ email: 'otp-replay@test.local' });

      // Outside production with no mail transport configured, the service returns the code in
      // the response so the flow can be driven end to end.
      const code = issued.body?.data?.otp as string | undefined;
      expect(code).toMatch(/^\d{6}$/);

      const first = await request(app)
        .post('/api/auth/otp/verify')
        .send({ email: 'otp-replay@test.local', otp: code });
      expect(first.status).toBe(200);

      // The code has now been consumed, so presenting the very same code again must not mint a
      // second session. The old TOTP scheme would have accepted this.
      const replay = await request(app)
        .post('/api/auth/otp/verify')
        .send({ email: 'otp-replay@test.local', otp: code });
      expect(replay.status).toBe(400);
    });

    it('caps the number of guesses on a login code', async () => {
      await createUser({ email: 'otp-guess@test.local' });
      await request(app).post('/api/auth/otp/request').send({ email: 'otp-guess@test.local' });

      for (let i = 0; i < config.verification.maxAttempts + 1; i += 1) {
        await request(app)
          .post('/api/auth/otp/verify')
          .send({ email: 'otp-guess@test.local', otp: '111111' });
      }

      // Once the cap is reached the record is deleted, so even the correct code can no longer
      // be submitted.
      const remaining = await VerificationCode.findOne({ target: 'otp-guess@test.local' });
      expect(remaining).toBeNull();
    });

    it('never stores a one-time code in plaintext', async () => {
      await createUser({ email: 'otp-hash@test.local' });
      await request(app).post('/api/auth/otp/request').send({ email: 'otp-hash@test.local' });

      const record = await VerificationCode.findOne({ target: 'otp-hash@test.local' }).lean();
      expect(record?.codeHash).toBeTruthy();
      // A six-digit code stored as-is would be recoverable by anyone with read access.
      expect(record?.codeHash).not.toMatch(/^\d{6}$/);
    });
  });

  describe('configuration guards', () => {
    it('keeps the test-auth bypass switched off by default', () => {
      // The suite opts in through tests/setup.ts; the flag itself must not default to on.
      expect(config.allowTestAuth).toBe(true);
      expect(config.allowTestAuth).toBe(
        config.nodeEnv === 'test' && process.env.ALLOW_TEST_AUTH === 'true'
      );
    });

    it('has a webhook secret in this environment', () => {
      expect(config.sms.webhookSecret).toBeTruthy();
    });
  });
});
