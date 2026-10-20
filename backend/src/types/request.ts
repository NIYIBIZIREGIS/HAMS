import { Request } from 'express';

/**
 * A request that also carries the bytes exactly as they arrived on the wire.
 *
 * Populated by the `verify` hook in `app.ts`. Needed by webhook signature checks: an HMAC is
 * computed over the precise payload, and re-serialising the parsed object would change key
 * order and whitespace, producing a different digest for a legitimate request.
 */
export interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}
