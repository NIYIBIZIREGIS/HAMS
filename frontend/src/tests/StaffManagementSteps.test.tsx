import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import StaffManagement from '../pages/admin/StaffManagement';
import '../i18n';

// The page lists staff through react-query; the step logic under test does not depend on it.
vi.mock('../services/client', () => ({
  client: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  getErrorMessage: () => 'Request failed',
}));

/**
 * Adding a staff member is a two-step form: identity first, then the sign-in password. The
 * behaviour worth protecting is that Continue is gated on the identity fields alone — if it
 * also demanded the password, the step split would be decorative and the form would still have
 * to be completed in one pass.
 */
const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StaffManagement />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const openAddModal = async (user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) => {
  await user.click(screen.getByText('Add Staff'));
  return screen.getByRole('dialog');
};

describe('Add Staff Member steps', () => {
  it('starts on the identity step with no password field in sight', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^role$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('will not continue until name, email and role are given', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
    // Still on step one, and still no password field.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('reveals the password once the identity step is valid', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText(/^role$/i), screen.getByRole('option', { name: /receptionist/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    // Identity fields are behind us, not repeated.
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });

  it('can go back to the identity step and keeps what was typed', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText(/^role$/i), screen.getByRole('option', { name: /receptionist/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Smith');
    expect(screen.getByLabelText(/email/i)).toHaveValue('jane@example.com');
  });

  it('never asks for the password before the user reaches that step', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    // Blur every field on step one: leaving them must not complain about a password that is
    // not on this screen yet.
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.click(screen.getByLabelText(/email/i));
    await user.tab();

    expect(screen.queryByText(/password must be/i)).not.toBeInTheDocument();
  });

  it('reports a short password on the credentials step', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.selectOptions(screen.getByLabelText(/^role$/i), screen.getByRole('option', { name: /receptionist/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /^add staff member$/i }));

    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
  });
});