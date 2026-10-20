import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Register } from '../pages/auth/Register';
import '../i18n';

/**
 * These cover a bug that made the form unusable for a real share of users: the name rule was
 * ASCII-letters-and-spaces, which rejected "Dr. Jean Niyonzima" and "Théogène Nzabonimpa" —
 * names this project's own seed data contains. Separately, a field painted itself red the
 * moment it lost focus even when it was perfectly valid, so a correctly filled form appeared
 * to be full of errors.
 */
async function fillStepOne(user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>, fullName: string, email: string) {
  await user.type(screen.getByLabelText(/full name/i), fullName);
  await user.type(screen.getByLabelText(/email/i), email);
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

describe('Register step one validation', () => {
  // Each name gets its own test rather than a loop inside one, so a failure points at the
  // specific character class that broke and each render is cleaned up on its own.
  it.each([
    ['a title', 'Dr. Jean Niyonzima'],
    ['an accent', 'Théogène Nzabonimpa'],
    ['a hyphen', 'Anne-Marie Uwase'],
    ["an apostrophe", "Claver O'Brien"],
  ])('accepts a name with %s', async (_label, fullName) => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillStepOne(user, fullName, 'alice@example.com');

    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.queryByText(/only contain letters and spaces/i)).not.toBeInTheDocument();
  });

  it('accepts a name with a title and moves to the security step', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillStepOne(user, 'Dr. Jean Niyonzima', 'alice@example.com');

    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.queryByText(/only contain letters and spaces/i)).not.toBeInTheDocument();
  });

  it('does not flag a valid email just because the field lost focus', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const email = screen.getByLabelText(/email/i);
    await user.type(email, 'alice@example.com');
    await user.tab();

    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
  });

  it('still blocks a name that is not a name, and says why', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillStepOne(user, 'Agent 007', 'alice@example.com');

    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/may only contain letters/i).length).toBeGreaterThan(0);
  });

  it('rejects an email that is missing its domain', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillStepOne(user, 'Alice Uwase', 'alice@example');

    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Enter a valid email address').length).toBeGreaterThan(0);
  });
});