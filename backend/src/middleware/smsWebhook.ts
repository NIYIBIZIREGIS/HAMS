import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';
import { RawBodyRequest } from '../types/request';

/**
 * Verifies inbound SMS/USSD gateway webhooks.
 *
 * The endpoint is unauthenticated by necessity — the gateway has no account with us — so
 * authenticity has to come from a signature the gateway alone can produce. Three properties
 * matter, and a signature alone does not give any of them:
 *
 *  - The signature is computed over the *raw* body plus a timestamp, so a captured request
 *    cannot be edited and re-signed, and the timestamp is inside the signed material.
 *  - The timestamp is checked against a tolerance window, so a captured request cannot be
 *    replayed indefinitely.
 *  - A delivery id is remembered for the same window, so a request that arrives twice inside
 *    the tolerance is rejected the second time. Without this, a captured request replayed
 *    rapidly would satisfy both the signature and the freshness check.
 *
 * If no shared secret is configured the endpoint refuses everything. Failing closed is the
 * only safe reading: an unconfigured secret means nobody has authenticated the gateway, and
 * accepting traffic anyway would be indistinguishable from having no authentication at all.
 */
export function verifySmsSignature(req: Request, _res: Response, next: NextFunction) {
  if (!config.sms.webhookSecret) {
    return next(
      new AppError(503, 'SMS webhook is not configured: set SMS_WEBHOOK_SECRET to enable it')
    );
  }

  const signature = header(req, 'x-sms-signature') ?? header(req, 'x-signature');
  const timestamp = header(req, 'x-sms-timestamp') ?? header(req, 'x-timestamp');
  const deliveryId = header(req, 'x-sms-delivery-id') ?? header(req, 'x-delivery-id');

  if (!signature || !timestamp) {
    return next(new AppError(401, 'Missing webhook signature'));
  }

  const sentAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sentAt)) {
    return next(new AppError(401, 'Malformed webhook timestamp'));
  }

  const skewSeconds = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
  if (skewSeconds > config.sms.webhookToleranceSeconds) {
    return next(new AppError(401, 'Webhook timestamp outside the accepted window'));
  }

  const raw = (req as RawBodyRequest).rawBody;
  if (!raw) {
    // Reached only if the route is mounted without the raw-body capture; without the exact
    // bytes there is nothing to verify against.
    return next(new AppError(401, 'Unable to verify webhook signature'));
  }

  const expected = createHmac('sha256', config.sms.webhookSecret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest('hex');

  if (!safeEqual(expected, signature)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  // Verified: replay protection is the only thing left, and it is deliberately not applied to
  // unverified traffic so an attacker cannot fill the replay store with junk.
  if (deliveryId) {
    const fresh = rememberDelivery(deliveryId);
    if (!fresh) {
      return next(new AppError(409, 'Duplicate webhook delivery'));
    }
  }

  return next();
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

/** Constant-time comparison; a length mismatch is rejected without inspecting the contents. */
function safeEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Delivery ids seen inside the tolerance window.
 *
 * Held in memory with lazy expiry rather than in the database: a webhook acknowledgement must
 * not depend on a write succeeding, and this volume is small. A multi-instance deployment
 * would need it shared, which is the one limitation of this approach.
 */
const seenDeliveries = new Map<string, number>();

function rememberDelivery(id: string): boolean {
  const now = Date.now();
  for (const [key, expires] of seenDeliveries) {
    if (expires <= now) seenDeliveries.delete(key);
  }
  if (seenDeliveries.has(id)) return false;
  seenDeliveries.set(id, now + config.sms.webhookToleranceSeconds * 1000);
  return true;
}

/** Exposed for tests, which need a clean replay store between cases. */
export function _resetSmsReplayStore(): void {
  seenDeliveries.clear();
}
