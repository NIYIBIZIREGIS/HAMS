import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { FacilityRegistryPage } from '../pages/superadmin/FacilityRegistryPage';
import '../i18n';

// Twelve facilities so pagination has a second page, cycling both the type and the
// subscription so every pill has company on the first page.
const { facilities, users } = vi.hoisted(() => {
  const types = ['hospital', 'clinic', 'health_center', 'district_office'];
  const subscriptions = ['active', 'trial', 'expired', 'suspended'];

  const facilities = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const subscriptionStatus = subscriptions[i % subscriptions.length];
    return {
      _id: `f${n}`,
      name: `Hospital ${String(n).padStart(2, '0')}`,
      type: types[i % types.length],
      address: `Address ${n}`,
      district: `District ${n}`,
      region: `Region ${n}`,
      logo: '',
      contactInfo: {
        phone: `078${String(1000000 + n)}`,
        email: `h${n}@example.com`,
      },
      subscriptionStatus,
      isActive: subscriptionStatus !== 'suspended',
      deletedAt: null,
    };
  });

  // Only the first facility has an administrator; the rest fall back to the amber pill.
  const users = [
    { _id: 'u1', fullName: 'Admin One', role: 'facility_admin', facilityId: 'f1' },
    { _id: 'u2', fullName: 'Dr Regular', role: 'doctor', facilityId: 'f1' },
  ];

  return { facilities, users };
});

// The page issues two reads — the registry and the user list — through the same transport.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn((url: string) =>
      Promise.resolve({
        data: { data: url.startsWith('/users') ? users : facilities },
      }),
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

/** Everything below the header row. */
const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('Facilities table', () => {
  it('labels every column', async () => {
    renderPage();
    await screen.findByText('Hospital 01');

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Hospital',
      'Location',
      'Type',
      'Admin',
      'Subscription',
      'Status',
      'Actions',
    ]);
  });

  it('shows eight facilities on the first page with their badges and details', async () => {
    renderPage();
    await screen.findByText('Hospital 01');

    expect(bodyRows()).toHaveLength(8);
    expect(screen.getByText('Region 1, District 1')).toBeInTheDocument();
    expect(screen.getByText('0781000001')).toBeInTheDocument();
    expect(screen.getAllByText('health center')).toHaveLength(2);
    expect(screen.getAllByText('district office')).toHaveLength(2);
    // One administrator, seven gaps.
    expect(screen.getByText('Admin One')).toBeInTheDocument();
    expect(screen.getAllByText('No admin yet')).toHaveLength(7);
    // The subscription reads as a dot plus a label, so the casing is the raw value.
    expect(screen.getAllByText('active')).toHaveLength(2);
    // Second page rows are not rendered until asked for.
    expect(screen.queryByText('Hospital 09')).not.toBeInTheDocument();
  });

  it('names the menu trigger after the facility it belongs to', async () => {
    renderPage();
    await screen.findByText('Hospital 01');

    const trigger = screen.getByRole('button', { name: 'Actions for Hospital 01' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', { name: 'Actions for Hospital 08' }),
    ).toBeInTheDocument();
  });

  it('numbers the pages and moves to the second page', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hospital 01');

    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    await screen.findByText('Hospital 09');
    expect(screen.queryByText('Hospital 01')).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(4);
  });

  it('reports the real range instead of claiming rows that are not there', async () => {
    renderPage();
    await screen.findByText('Hospital 01');

    expect(screen.getByText('1–8')).toBeInTheDocument();
    // One count in the toolbar's lead line, one in the stat card, one in the footer range.
    expect(screen.getAllByText('12')).toHaveLength(3);
  });

  it('narrows to matching facilities and can be cleared again', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hospital 01');

    await user.type(screen.getByPlaceholderText(/search hospitals/i), 'Hospital 12');

    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(screen.getByText('Hospital 12')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Clear search'));

    await waitFor(() => expect(bodyRows()).toHaveLength(8));
    expect(screen.getByText('Hospital 01')).toBeInTheDocument();
  });

  it('offers a way out of an empty result instead of a dead end', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Hospital 01');

    await user.type(screen.getByPlaceholderText(/search hospitals/i), 'zzzz-no-such-hospital');

    await screen.findByText('No hospitals match your filters');
    expect(bodyRows()).toHaveLength(1);
    // The header still offers one, and the empty state adds a second.
    expect(screen.getAllByRole('button', { name: 'Register Hospital' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    await waitFor(() => expect(bodyRows()).toHaveLength(8));
    expect(
      screen.queryByText('No hospitals match your filters'),
    ).not.toBeInTheDocument();
  });
});
