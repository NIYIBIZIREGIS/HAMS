process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.OTP_SECRET = 'test-otp-secret';
process.env.SEED_ON_START = 'false';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// The `x-test-user` header is a deliberate authentication bypass, so the suite has to ask for
// it explicitly. Without this line the entire isolation and RBAC suite would run against a
// server that rejects the header, which is the correct production posture.
process.env.ALLOW_TEST_AUTH = 'true';

// A fixed secret keeps webhook signatures reproducible in tests; the HMAC is computed with
// whatever value is set here.
process.env.SMS_WEBHOOK_SECRET = 'test-sms-webhook-secret';

// Use the locally installed MongoDB instead of downloading a memory-server binary.
process.env.MONGOMS_SYSTEM_BINARY = 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe';
