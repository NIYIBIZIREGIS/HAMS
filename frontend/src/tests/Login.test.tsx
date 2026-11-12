import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Login } from '../pages/auth/Login';
import '../i18n';

describe('Login page', () => {
  it('offers only email and password sign-in', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use national ID' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log in with a code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send code' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });
});
