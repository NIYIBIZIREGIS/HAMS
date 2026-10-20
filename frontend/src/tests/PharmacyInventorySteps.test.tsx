import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { PharmacyInventoryPage } from '../pages/pharmacy/PharmacyInventoryPage';
import { useAuthStore } from '../store/authStore';
import '../i18n';

// The inventory list is fetched; the step logic under test does not depend on it.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [], meta: { total: 0 } } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  getErrorMessage: () => 'Request failed',
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  getAccessToken: () => null,
}));

/**
 * Adding an inventory item was one long wall of fields, which pushed the modal's action row off
 * screen. It is now split: the drug's identity first (name, form, strength, hospital), then the
 * batch/stock figures. The property worth protecting is that the two steps do not repeat each
 * other's fields, and that the expiry date required to submit lives on step two.
 */
const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.setState({ user: { role: 'facility_admin' } as never });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PharmacyInventoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openAddModal = async (user: ReturnType<typeof import('@testing-library/user-event')['default']['setup']>) => {
  await user.click(screen.getByRole('button', { name: /add item/i }));
  return screen.getByRole('dialog');
};

describe('Add Inventory Item steps', () => {
  it('starts on drug details with no batch/stock fields in sight', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddModal(user);

    expect(within(dialog).getByLabelText(/drug name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/strength/i)).toBeInTheDocument();
    // These belong to step two and must not crowd step one.
    expect(within(dialog).queryByLabelText(/batch number/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/expiry date/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('reveals the batch/stock step without repeating the drug details step', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddModal(user);
    await user.type(within(dialog).getByLabelText(/drug name/i), 'Paracetamol');
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));

    expect(within(dialog).getByLabelText(/batch number/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/expiry date/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/quantity/i)).toBeInTheDocument();
    // The identity fields are behind us, not repeated.
    expect(within(dialog).queryByLabelText(/drug name/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('keeps what was typed when stepping back', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddModal(user);
    await user.type(within(dialog).getByLabelText(/drug name/i), 'Paracetamol');
    await user.type(within(dialog).getByLabelText(/strength/i), '500mg');
    await user.click(within(dialog).getByRole('button', { name: /continue/i }));
    await user.click(within(dialog).getByRole('button', { name: /back/i }));

    expect(within(dialog).getByLabelText(/drug name/i)).toHaveValue('Paracetamol');
    expect(within(dialog).getByLabelText(/strength/i)).toHaveValue('500mg');
    // Still on step one — batch fields stay hidden until Continue is pressed again.
    expect(within(dialog).queryByLabelText(/batch number/i)).not.toBeInTheDocument();
  });
});
