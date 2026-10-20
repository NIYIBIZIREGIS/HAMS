import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { FacilityRegistryPage } from '../pages/superadmin/FacilityRegistryPage';
import '../i18n';

// The page reads the registry and the user list through react-query; the step behaviour under
// test does not depend on the rows, so an empty registry is fine.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn((url: string) =>
      Promise.resolve({ data: { data: url.startsWith('/users') ? [] : [] } }),
    ),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: () => 'Request failed',
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FacilityRegistryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openRegisterModal = async (
  user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>,
) => {
  // The header and the empty state both carry a "Register Hospital" button.
  const [header] = await screen.findAllByRole('button', { name: 'Register Hospital' });
  await user.click(header);
  return screen.getByRole('dialog');
};

describe('Hospital registration steps', () => {
  it('starts on the details step with no subscription or admin fields in sight', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);

    expect(within(dialog).getByLabelText(/hospital name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/hospital type/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/subscription status/i)).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(/create the first hospital admin/i),
    ).not.toBeInTheDocument();
  });

  it('does not allow continuing while the name is missing', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);

    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('reveals subscription and admin once the details step is valid', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);
    await user.type(within(dialog).getByLabelText(/hospital name/i), 'Kigali Central Hospital');
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));

    expect(within(dialog).getByLabelText(/subscription status/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/create the first hospital admin/i)).toBeChecked();
    expect(within(dialog).getByLabelText(/admin full name/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Register Hospital' }),
    ).toBeInTheDocument();
    // Details are behind us, not repeated.
    expect(within(dialog).queryByLabelText(/hospital name/i)).not.toBeInTheDocument();
  });

  it('keeps what was typed when stepping back from the second step', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);
    await user.type(within(dialog).getByLabelText(/hospital name/i), 'Kigali Central Hospital');
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));
    await user.click(within(dialog).getByRole('button', { name: /back/i }));

    expect(within(dialog).getByLabelText(/hospital name/i)).toHaveValue(
      'Kigali Central Hospital',
    );
  });

  it('only allows registering once the admin details are complete as well', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);
    await user.type(within(dialog).getByLabelText(/hospital name/i), 'Kigali Central Hospital');

    const registerButton = () => within(dialog).getByRole('button', { name: 'Register Hospital' });

    // First admin exists by default, so the register button is held until the admin is valid.
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: /continue/i }));
    expect(registerButton()).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/admin full name/i), 'Alice Mukamana');
    await user.type(within(dialog).getByLabelText(/admin email/i), 'alice@facility.rw');

    expect(registerButton()).toBeEnabled();
  });

  it('lets an admin be skipped, which unblocks registration immediately', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openRegisterModal(user);
    await user.type(within(dialog).getByLabelText(/hospital name/i), 'Kigali Central Hospital');
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));

    await user.click(within(dialog).getByLabelText(/create the first hospital admin/i));
    expect(within(dialog).getByLabelText(/create the first hospital admin/i)).not.toBeChecked();
    expect(
      within(dialog).getByRole('button', { name: 'Register Hospital' }),
    ).toBeEnabled();
  });
});