import { registerSchema } from '../src/validators/schemas';

/**
 * Registration validation is the first thing a real user meets, and it is also the easiest
 * place to reject someone who did nothing wrong. These cases are drawn from names this
 * project's own seed data already contains, because a validation rule that refuses the
 * project's fixtures is a validation rule that refuses real people.
 */
describe('registration validation', () => {
  const valid = {
    email: 'alice@example.com',
    password: 'Str0ng!pass',
  };

  const accepts = (fullName: string) =>
    registerSchema.safeParse({ ...valid, fullName }).success;

  describe('full name', () => {
    it.each([
      ['plain names', 'Alice Uwase'],
      ['a title, as clinicians are written', 'Dr. Jean Niyonzima'],
      ['a hyphenated name', 'Anne-Marie Uwase'],
      ['an apostrophe', "Claver O'Brien"],
      ['a curly apostrophe', 'Claver O’Brien'],
      ['accents, which en/fr/rw rosters rely on', 'Théogène Nzabonimpa'],
      ['surrounding whitespace', '  Alice Uwase  '],
    ])('accepts %s', (_label, fullName) => {
      expect(accepts(fullName)).toBe(true);
    });

    it.each([
      ['an empty name', ''],
      ['whitespace only', '     '],
      ['punctuation only', '---'],
      ['an embedded email', 'alice@example.com'],
      ['an embedded number', 'Agent 007'],
      ['markup', '<script>alert(1)</script>'],
      ['a name that is too short', 'Al'],
    ])('rejects %s', (_label, fullName) => {
      expect(accepts(fullName)).toBe(false);
    });

    it('rejects a name longer than 100 characters', () => {
      expect(accepts('a'.repeat(101))).toBe(false);
    });
  });

  describe('email', () => {
    it('accepts an address with surrounding whitespace', () => {
      const result = registerSchema.safeParse({ ...valid, fullName: 'Alice Uwase', email: '  alice@example.com  ' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBe('alice@example.com');
    });

    it.each([['alice'], ['alice@'], ['@example.com'], ['alice@example'], ['alice example.com']])(
      'rejects %s',
      (email) => {
        expect(registerSchema.safeParse({ ...valid, fullName: 'Alice Uwase', email }).success).toBe(false);
      }
    );
  });
});