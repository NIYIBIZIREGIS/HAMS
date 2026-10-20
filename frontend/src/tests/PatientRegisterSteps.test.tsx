import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { PatientManagement } from '../pages/management/PatientManagement';
import '../i18n';

// The page lists patients through react-query; the step logic under test does not depend on it.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: () => 'Request failed',
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  getAccessToken: () => null,
}));

/**
 * Registering a patient is a two-step form: identity and credentials first, medical details
 * and hospital assignment second. The behaviour worth protecting is that Continue is gated on
 * the identity fields alone — medical details are optional, so the form must not demand them
 * before the user can move, and the fields must not all appear at once.
 */
const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openModal = async (user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) => {
  await user.click(screen.getByRole('button', { name: 'Register Patient' }));
  return screen.getByRole('dialog');
};

const fillIdentity = async (user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) => {
  await user.type(screen.getByLabelText(/full name/i), 'Jean Mugisha');
  await user.type(screen.getByLabelText(/^email$/i), 'jean@example.com');
  await user.type(screen.getByLabelText(/^phone$/i), '0788123456');
  await user.type(screen.getByLabelText(/national id/i), '1198800123456789');
  await user.type(screen.getByLabelText(/^password$/i), 'Passw0rd!');
};

describe('Register Patient steps', () => {
  it('starts on the identity step with no medical fields in sight', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openModal(user);

    expect(within(dialog).getByLabelText(/full name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/blood group/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('keeps Continue disabled until every identity field is valid', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openModal(user);
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeDisabled();

    await fillIdentity(user);
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('reveals the medical step once identity is valid, without repeating it', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openModal(user);
    await fillIdentity(user);
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));

    expect(within(dialog).getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/gender/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/blood group/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/allergies/i)).toBeInTheDocument();
    // Identity fields are behind us, not repeated.
    expect(within(dialog).queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /register patient/i })).toBeInTheDocument();
  });

  it('can go back to identity and keeps what was typed', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openModal(user);
    await fillIdentity(user);
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));
    await user.click(within(dialog).getByRole('button', { name: /back/i }));

    expect(within(dialog).getByLabelText(/full name/i)).toHaveValue('Jean Mugisha');
    expect(within(dialog).getByLabelText(/^phone$/i)).toHaveValue('0788123456');
    // Still on step one — medical fields stay hidden until Continue is pressed again.
    expect(within(dialog).queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeEnabled();
  });
});
