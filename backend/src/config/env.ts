import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function flag(name: string, fallback = 'false'): boolean {
  return (process.env[name] || fallback).toLowerCase() === 'true';
}

/**
 * Values that must never reach production with their development default.
 *
 * The defaults exist so a fresh clone runs locally without ceremony. Shipping them would mean
 * every deployment shares the same signing key, and a leaked key then invalidates every other
 * install rather than one. Failing at boot is the only safe response: a process that starts
 * with a known secret looks healthy while being trivially forgeable.
 */
function requireProductionSecret(name: string, value: string, placeholder: string): string {
  if (isProduction && (!value || value === placeholder)) {
    throw new Error(
      `${name} must be set to a unique value when NODE_ENV=production. ` +
        `Refusing to start with the development default.`
    );
  }
  return value;
}

const jwtAccessSecret = requireProductionSecret(
  'JWT_ACCESS_SECRET',
  process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
  'dev-access-secret-change-me'
);
const jwtRefreshSecret = requireProductionSecret(
  'JWT_REFRESH_SECRET',
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  'dev-refresh-secret-change-me'
);
const otpSecret = requireProductionSecret(
  'OTP_SECRET',
  process.env.OTP_SECRET || 'dev-otp-secret-change-me',
  'dev-otp-secret-change-me'
);

if (isProduction && (jwtAccessSecret === jwtRefreshSecret || jwtAccessSecret === otpSecret)) {
  throw new Error(
    'JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and OTP_SECRET must be distinct values in production. ' +
      'Reusing one key across purposes lets an attacker who learns it forge tokens for all three.'
  );
}

export const config = {
  nodeEnv,
  isProduction,
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/has',
  jwt: {
    accessSecret: jwtAccessSecret,
    refreshSecret: jwtRefreshSecret,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otpSecret,
  /**
   * Number of reverse proxies in front of the app. `true` trusts `X-Forwarded-For`
   * unconditionally, which is only safe when nothing but your own proxy can reach the app;
   * a hop count is the safer default. Audit entries record `req.ip`, so an incorrect value here
   * misattributes every logged action.
   */
  trustProxy: (() => {
    const raw = process.env.TRUST_PROXY;
    if (raw === undefined || raw === '') return false;
    if (raw.toLowerCase() === 'true') return true;
    const hops = Number.parseInt(raw, 10);
    return Number.isNaN(hops) ? false : hops;
  })(),
  /**
   * Opt-in header-based authentication, used by the test suite to act as an arbitrary user
   * without minting tokens. Gated on its own flag as well as NODE_ENV=test: a production
   * process that is accidentally started with NODE_ENV=test would otherwise accept an
   * `x-test-user` header from the internet and hand that account a valid session.
   */
  allowTestAuth: flag('ALLOW_TEST_AUTH') && nodeEnv === 'test',
  otp: {
    ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'log',
    /** Shared secret for verifying inbound gateway webhooks. Empty means the webhook is refused. */
    webhookSecret: process.env.SMS_WEBHOOK_SECRET || '',
    /** Reject a webhook whose signed timestamp is further off than this. */
    webhookToleranceSeconds: parseInt(process.env.SMS_WEBHOOK_TOLERANCE_SECONDS || '300', 10),
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      from: process.env.TWILIO_FROM || '',
    },
    africastalking: {
      username: process.env.AT_USERNAME || '',
      apiKey: process.env.AT_API_KEY || '',
      from: process.env.AT_FROM || '',
    },
    generic: {
      url: process.env.SMS_GATEWAY_URL || '',
      apiKey: process.env.SMS_GATEWAY_API_KEY || '',
      from: process.env.SMS_GATEWAY_FROM || '',
    },
  },
  // Off unless explicitly enabled. `src/seed.ts` writes its own hospital fixtures, and running
  // it on top of `scripts/seedDemoData.ts` left the two cohorts overlapping in one database,
  // so demo data now comes from the one script that is run deliberately.
  seedOnStart: (process.env.SEED_ON_START || 'false').toLowerCase() === 'true',
  seedSuperAdmin: {
    email: process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@has.local',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@12345',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '"HAS" <no-reply@has.local>',
  },
  verification: {
    codeTtlMinutes: parseInt(process.env.VERIFICATION_CODE_TTL_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.VERIFICATION_MAX_ATTEMPTS || '5', 10),
    resendCooldownSeconds: parseInt(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS || '60', 10),
  },
} as const;

// A known default super-admin password in production is a standing invitation, so it is
// refused at boot on the same grounds as the signing secrets.
if (
  isProduction &&
  (!process.env.SEED_SUPER_ADMIN_PASSWORD ||
    process.env.SEED_SUPER_ADMIN_PASSWORD === 'Admin@12345')
) {
  throw new Error(
    'SEED_SUPER_ADMIN_PASSWORD must be set to a unique value when NODE_ENV=production. ' +
      'Refusing to start with the default super-admin password.'
  );
}
