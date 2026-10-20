import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Login } from '../pages/auth/Login';
import '../i18n';

describe('Login page', () => {
  it('renders the three login modes', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Use email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use national ID' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in with a code' })).toBeInTheDocument();
  });

  it('switches to the OTP tab when clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: 'Log in with a code' }));
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
  });
});
