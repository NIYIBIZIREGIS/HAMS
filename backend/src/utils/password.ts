import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

// Ambiguous glyphs (0/O, 1/l/I) are excluded so a password can be read aloud or copied off
// a printed handover sheet without corrupting it.
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?';

function pick(alphabet: string): string {
  return alphabet[crypto.randomInt(alphabet.length)];
}

/**
 * Generates a one-time temporary password for a newly onboarded staff account.
 *
 * Uses `crypto.randomInt` for every character, including the guaranteed letter/digit/
 * symbol, rather than shuffling a fixed pool, so the result is not predictable from the
 * character classes. Satisfies the same `strongPassword` rule as user-supplied passwords.
 */
export function generateTemporaryPassword(length = 14): string {
  const required = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS), pick(SYMBOLS)];

  const rest: string[] = [];
  for (let i = 0; i < Math.max(0, length - required.length); i += 1) {
    rest.push(pick([UPPERCASE, LOWERCASE, DIGITS, SYMBOLS][crypto.randomInt(4)]));
  }

  // Fisher-Yates with a CSPRNG so the guaranteed characters are not always in front.
  const all = [...required, ...rest];
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join('');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/*
 * One-time codes are issued and checked by `services/verification`, which stores only a hash,
 * marks a code consumed on first use, caps the number of guesses and expires it.
 *
 * This file previously exported a TOTP derived from a static secret and the user's email. It
 * was replaced because a derived code is valid for its whole window and could be presented
 * again afterwards, and because nothing recorded an attempt count. Anything needing a one-time
 * code should use the verification service so those guarantees apply. */

