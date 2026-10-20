import request from 'supertest';
import { app } from '../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers';
import { createUser } from './factories';
import { User } from '../src/models';
import { generateCode } from '../src/services/verification';

describe('Auth flow', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('registers a new patient and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Jane Doe',
      email: 'jane@test.local',
      password: 'Password@123',
      // National format: `phoneSchema` requires 10 digits starting with 0, and
      // `normalizePhone` converts it to +250 form only when sending an SMS.
      phone: '0700000123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.patientNumber).toMatch(/^PT-\d{5}$/);
  });

  it('rejects a phone number that is not in national format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Jane Doe',
      email: 'e164@test.local',
      password: 'Password@123',
      phone: '+250700000123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate registration', async () => {
    const payload = {
      fullName: 'Jane Doe',
      email: 'jane@test.local',
      password: 'Password@123',
    };
    await request(app).post('/api/auth/register').send(payload);
    const second = await request(app).post('/api/auth/register').send(payload);
    expect(second.status).toBe(409);
  });

  it('rejects weak passwords during validation', async () => {
    const res = await request(app).post('/api/auth/register').send({
      fullName: 'Weak',
      email: 'weak@test.local',
      password: 'short',
    });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const user = await createUser({ email: 'login@test.local' }, 'Password@123');

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Password@123' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tokens.accessToken).toBeTruthy();

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Wrong@1234' });
    expect(bad.status).toBe(401);
  });

  it('logs in via national ID', async () => {
    await createUser({ nationalId: 'NID-123456' }, 'Password@123');

    const res = await request(app)
      .post('/api/auth/login/national-id')
      .send({ nationalId: 'NID-123456', password: 'Password@123' });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
  });

  it('refreshes tokens and revokes the old refresh token', async () => {
    const user = await createUser({ email: 'refresh@test.local' }, 'Password@123');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Password@123' });
    const refreshToken = login.body.data.tokens.refreshToken;

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.tokens.refreshToken).not.toBe(refreshToken);

    // Old token is now revoked
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('verifies an OTP login (dev OTP returned in response)', async () => {
    await createUser({ email: 'otp@test.local' }, 'Password@123');

    const requestOtp = await request(app).post('/api/auth/otp/request').send({ email: 'otp@test.local' });
    expect(requestOtp.status).toBe(200);
    const otp = requestOtp.body.data.otp;
    expect(otp).toHaveLength(6);

    const verify = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'otp@test.local', otp });
    expect(verify.status).toBe(200);
    expect(verify.body.data.tokens.accessToken).toBeTruthy();
  });

  it('resets a forgotten password via OTP', async () => {
    await createUser({ email: 'reset@test.local' }, 'Password@123');

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.local' });
    expect(forgot.status).toBe(200);
    const otp = forgot.body.data.otp;

    const reset = await request(app).post('/api/auth/reset-password').send({
      email: 'reset@test.local',
      otp,
      newPassword: 'NewPassword@123',
    });
    expect(reset.status).toBe(200);

    const user = await User.findOne({ email: 'reset@test.local' });
    expect(user).toBeTruthy();
  });

  it('validates OTP matches', async () => {
    await createUser({ email: 'otpcheck@test.local' }, 'Password@123');
    const bad = await request(app)
      .post('/api/auth/otp/verify')
      .send({ email: 'otpcheck@test.local', otp: '000000' });
    expect(bad.status).toBe(400);
  });

  it('does not derive a one-time code from the email', () => {
    // This used to assert the opposite: that the code was a deterministic function of the
    // address, which meant a derived code stayed valid for its whole window and could be
    // presented again. Codes now come from the CSPRNG in the verification service, so two
    // codes for the same address must differ.
    const codes = new Set(
      Array.from({ length: 20 }, () => generateCode())
    );
    expect(codes.size).toBeGreaterThan(1);
    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});
