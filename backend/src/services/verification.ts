import crypto from 'crypto';
import { config } from '../config/env';
import { VerificationCode } from '../models/VerificationCode';
import { sha256 } from '../utils/tokens';
import { AppError, badRequest } from '../utils/AppError';

export type VerificationChannel = 'email' | 'sms';
export type VerificationPurpose = 'account' | 'login' | 'reset_password';

export interface SendResult {
  ok: boolean;
  via: 'smtp' | 'twilio' | 'africastalking' | 'generic' | 'log';
  reason?: string;
}

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function hashCode(code: string): string {
  return sha256(`verify:${code}`);
}

type Mailer = {
  sendMail: (m: Record<string, unknown>) => Promise<unknown>;
};

let emailTransporter: Mailer | null = null;

async function getEmailTransporter(): Promise<Mailer> {
  if (!emailTransporter) {
    const nodemailer = await import('nodemailer');
    emailTransporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user
        ? { user: config.mail.user, pass: config.mail.pass }
        : undefined,
    }) as Mailer;
  }
  return emailTransporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  if (config.mail.user && config.mail.host) {
    try {
      const transporter = await getEmailTransporter();
      await transporter.sendMail({
        from: config.mail.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return { ok: true, via: 'smtp' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[verification] SMTP send failed for ${opts.to}:`, message);
      return { ok: false, via: 'smtp', reason: message };
    }
  }
  if (config.nodeEnv !== 'test') {
    console.log(`[verification][email:log] to=${opts.to} subject="${opts.subject}" body="${opts.text}"`);
  }
  return { ok: false, via: 'log', reason: 'SMTP not configured' };
}

export function normalizePhone(phone: string): string {
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) return `+250${phone.slice(1)}`;
  return phone;
}

export async function sendSms(opts: { to: string; message: string }): Promise<SendResult> {
  const provider = config.sms.provider;

  if (provider === 'twilio' && config.sms.twilio.accountSid && config.sms.twilio.authToken) {
    try {
      const body = new URLSearchParams({
        To: normalizePhone(opts.to),
        From: config.sms.twilio.from,
        Body: opts.message,
      });
      const auth = Buffer.from(
        `${config.sms.twilio.accountSid}:${config.sms.twilio.authToken}`
      ).toString('base64');
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.sms.twilio.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
          },
          body: body.toString(),
        }
      );
      if (!res.ok) {
        console.error('[verification] Twilio error:', res.status, await res.text());
        return { ok: false, via: 'twilio', reason: `Twilio HTTP ${res.status}` };
      }
      return { ok: true, via: 'twilio' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[verification] Twilio send failed:', message);
      return { ok: false, via: 'twilio', reason: message };
    }
  }

  if (provider === 'africastalking' && config.sms.africastalking.apiKey) {
    try {
      const form = new URLSearchParams({
        username: config.sms.africastalking.username,
        to: normalizePhone(opts.to),
        message: opts.message,
      });
      if (config.sms.africastalking.from) form.set('from', config.sms.africastalking.from);
      const res = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey: config.sms.africastalking.apiKey,
        },
        body: form.toString(),
      });
      if (!res.ok) {
        console.error("[verification] Africa's Talking error:", res.status, await res.text());
        return { ok: false, via: 'africastalking', reason: `AT HTTP ${res.status}` };
      }
      return { ok: true, via: 'africastalking' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[verification] Africa's Talking send failed:", message);
      return { ok: false, via: 'africastalking', reason: message };
    }
  }

  if (provider === 'generic' && config.sms.generic.url) {
    try {
      const res = await fetch(config.sms.generic.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.sms.generic.apiKey
            ? { Authorization: `Bearer ${config.sms.generic.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          to: normalizePhone(opts.to),
          from: config.sms.generic.from,
          message: opts.message,
        }),
      });
      if (!res.ok) {
        console.error('[verification] Generic SMS gateway error:', res.status, await res.text());
        return { ok: false, via: 'generic', reason: `Gateway HTTP ${res.status}` };
      }
      return { ok: true, via: 'generic' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[verification] Generic SMS send failed:', message);
      return { ok: false, via: 'generic', reason: message };
    }
  }

  if (config.nodeEnv !== 'test') {
    console.log(`[verification][sms:log] to=${opts.to} body="${opts.message}"`);
  }
  return { ok: false, via: 'log', reason: 'SMS provider not configured' };
}

function maskTarget(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}

const CODE_TTL_MS = () => config.verification.codeTtlMinutes * 60 * 1000;

export interface IssueCodeOptions {
  userId: string;
  channel: VerificationChannel;
  target: string;
  purpose: VerificationPurpose;
  user: { fullName: string; email?: string };
}

export interface IssueCodeResult {
  delivered: boolean;
  via: SendResult['via'];
  devCode?: string;
}

/**
 * Generate a random 6-digit code, persist it (hashed) and dispatch it through the
 * configured email/SMS transport. Returns delivery info and, only when nothing was
 * actually delivered outside production, the plain code for local testing.
 */
export async function issueCode(opts: IssueCodeOptions): Promise<IssueCodeResult> {
  const { userId, channel, purpose } = opts;
  const normalized = channel === 'email' ? opts.target.toLowerCase() : opts.target;

  const cooldownMs = config.verification.resendCooldownSeconds * 1000;
  if (cooldownMs > 0) {
    const recent = await VerificationCode.findOne({
      userId,
      channel,
      purpose,
      consumedAt: null,
      createdAt: { $gte: new Date(Date.now() - cooldownMs) },
    });
    if (recent) {
      throw new AppError(429, 'Please wait before requesting another code.');
    }
  }

  // A previously issued, still-valid code can only be re-sent if we kept the plain
  // form (we don't). Simply retire it and issue a fresh one.
  await VerificationCode.deleteMany({
    userId,
    channel,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  const code = generateCode();
  await VerificationCode.create({
    userId,
    channel,
    target: normalized,
    purpose,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS()),
  });

  let send: SendResult;
  if (channel === 'email') {
    const { fullName } = opts.user;
    const subject = 'HAS verification code';
    const text = `Hello ${fullName},\n\nYour Hospital Appointments Management System verification code is: ${code}\n\nThis code expires in ${config.verification.codeTtlMinutes} minutes. If you did not request it, you can safely ignore this message.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto"><h2>HAS verification code</h2><p>Hello ${fullName},</p><p>Use the code below to verify your account:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f3f4f6;padding:12px;text-align:center;border-radius:8px">${code}</p><p>This code expires in ${config.verification.codeTtlMinutes} minutes.</p><p style="color:#888;font-size:12px">If you did not request this, please ignore this email.</p></div>`;
    send = await sendEmail({ to: normalized, subject, text, html });
  } else {
    send = await sendSms({
      to: normalized,
      message: `Your HAS verification code is ${code}. It expires in ${config.verification.codeTtlMinutes} minutes.`,
    });
  }

  const result: IssueCodeResult = { delivered: send.ok, via: send.via };
  if (!send.ok && config.nodeEnv !== 'production') {
    result.devCode = code;
  }
  return result;
}

export interface VerifyCodeOptions {
  channel: VerificationChannel;
  target: string;
  purpose: VerificationPurpose;
  code: string;
  maxAttempts?: number;
}

/**
 * Check a submitted code against the latest unconsumed code for (channel, target,
 * purpose). On success the record is marked consumed and the owning userId returned.
 */
export async function verifyCode(opts: VerifyCodeOptions): Promise<string> {
  const { channel, purpose, code } = opts;
  const normalized = channel === 'email' ? opts.target.toLowerCase() : opts.target;
  const maxAttempts = opts.maxAttempts ?? config.verification.maxAttempts;

  if (!/^\d{6}$/.test(code)) throw badRequest('Invalid code');

  const record = await VerificationCode.findOne({
    channel,
    target: normalized,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!record) throw badRequest('No active verification code found. Please request a new code.');
  if (record.expiresAt.getTime() < Date.now()) {
    throw badRequest('This code has expired. Please request a new code.');
  }
  if (record.attempts >= maxAttempts) {
    await VerificationCode.findByIdAndDelete(record._id);
    throw new AppError(429, 'Too many failed attempts. Please request a new code.');
  }

  record.attempts += 1;
  if (record.codeHash !== hashCode(code)) {
    await record.save();
    throw badRequest('Incorrect code. Please try again.');
  }

  record.consumedAt = new Date();
  await record.save();

  return String(record.userId);
}

export { maskTarget };