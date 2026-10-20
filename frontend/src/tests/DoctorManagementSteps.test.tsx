import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import DoctorManagement from '../pages/admin/DoctorManagement';
import { useAuthStore } from '../store/authStore';
import '../i18n';

// The table and the facility list are fetched; the step logic under test does not depend on them.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  getErrorMessage: () => 'Request failed',
}));

/**
 * Adding a doctor was thirteen fields in a single scrolling modal. It is now split: identity
 * first (name, national ID, email, phone, facility), then credentials and professional detail.
 * The property worth protecting is that step one is gated on identity alone — if Continue also
 * demanded the password and the licence details, the split would be cosmetic.
 */
const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { role: 'facility_admin' } as never });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorManagement />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const openAddModal = async (user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) => {
  await user.click(screen.getByRole('button', { name: /add doctor/i }));
  return screen.getByRole('dialog');
};

describe('Add Doctor steps', () => {
  it('starts on identity with no professional fields in sight', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // These belong to step two and must not crowd step one.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/licen[cs]e number/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('will not continue while the name is too short', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Dr J');
    await user.type(screen.getByLabelText(/email/i), 'jean@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Still on step one: no password field appeared.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('moves to credentials once identity is complete', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Jean Niyonzima');
    await user.type(screen.getByLabelText(/email/i), 'jean@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/licen[cs]e number/i)).toBeInTheDocument();
    // The submit button is in the dialog footer; the page-level trigger has the same label.
    expect(screen.getAllByRole('button', { name: /^add doctor$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('keeps what was typed when stepping back', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    await openAddModal(user);
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Jean Niyonzima');
    await user.type(screen.getByLabelText(/national id/i), '1199000012345678');
    await user.type(screen.getByLabelText(/email/i), 'jean@example.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Dr. Jean Niyonzima');
    expect(screen.getByLabelText(/national id/i)).toHaveValue('1199000012345678');
    expect(screen.getByLabelText(/email/i)).toHaveValue('jean@example.com');
  });
});