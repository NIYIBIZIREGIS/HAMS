import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { PatientManagement } from '../pages/management/PatientManagement';
import '../i18n';

// Twelve patients so pagination has a second page to show.
const { patients } = vi.hoisted(() => {
  const make = (i: number) => ({
    _id: `p${i}`,
    patientNumber: `PAT-${String(i).padStart(4, '0')}`,
    gender: i % 2 === 1 ? 'male' : 'female',
    bloodGroup: i % 3 === 0 ? 'O+' : '',
    userId: {
      fullName: `Patient ${i}`,
      email: `patient${i}@example.com`,
      phone: `078${String(1000000 + i)}`,
      nationalId: `1198${String(i).padStart(12, '0')}`,
    },
  });
  return { patients: Array.from({ length: 12 }, (_, k) => make(k + 1)) };
});

// The page reads the list through react-query; only the transport is under test here.
vi.mock('../services/client', () => ({
  client: {
    get: vi.fn().mockResolvedValue({ data: { data: patients } }),
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
        <PatientManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Everything below the header row. */
const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('Patients table', () => {
  it('labels every column', async () => {
    renderPage();
    await screen.findByText('PAT-0001');

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Patient',
      'Patient No.',
      'Contact',
      'National ID',
      'Gender',
      'Blood Group',
      'Actions',
    ]);
  });

  it('shows ten patients on the first page with their badges and contact details', async () => {
    renderPage();
    await screen.findByText('PAT-0001');

    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText('Patient 1')).toBeInTheDocument();
    expect(screen.getByText('patient1@example.com')).toBeInTheDocument();
    expect(screen.getByText('0781000001')).toBeInTheDocument();
    // Five of the first ten are male, five female, three carry a blood group.
    // The badge is uppercased with CSS only; the text in the DOM stays lowercase.
    expect(screen.getAllByText('male')).toHaveLength(5);
    expect(screen.getAllByText('female')).toHaveLength(5);
    expect(screen.getAllByText('O+')).toHaveLength(3);
    expect(screen.getAllByText('—')).toHaveLength(7);
    // Second page rows are not rendered until asked for.
    expect(screen.queryByText('PAT-0011')).not.toBeInTheDocument();
  });

  it('gives each row reachable view, edit and delete controls', async () => {
    renderPage();
    await screen.findByText('PAT-0001');

    expect(screen.getByRole('button', { name: 'View Patient 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Patient 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Patient 1' })).toBeInTheDocument();
  });

  it('numbers the pages and moves to the second page', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('PAT-0001');

    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    await screen.findByText('PAT-0011');
    expect(screen.queryByText('PAT-0001')).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);
  });

  it('reports the real range instead of claiming rows that are not there', async () => {
    renderPage();
    await screen.findByText('PAT-0001');

    // The old footer printed "Showing 1–10 of 12" even when fewer rows existed.
    expect(screen.getByText('1–10')).toBeInTheDocument();
    // One total in the toolbar, one in the footer.
    expect(screen.getAllByText('12')).toHaveLength(2);
  });

  it('narrows to matching patients and can be cleared again', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('PAT-0001');

    await user.type(screen.getByPlaceholderText(/search by name/i), 'PAT-0012');

    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(screen.getByText('Patient 12')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Clear search'));

    await waitFor(() => expect(bodyRows()).toHaveLength(10));
    expect(screen.getByText('Patient 1')).toBeInTheDocument();
  });

  it('offers a way out of an empty result instead of a dead end', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('PAT-0001');

    await user.type(screen.getByPlaceholderText(/search by name/i), 'zzzz-no-such-patient');

    await screen.findByText('No patients match your search');
    expect(bodyRows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /show all patients/i }));

    await waitFor(() => expect(bodyRows()).toHaveLength(10));
    expect(screen.queryByText('No patients match your search')).not.toBeInTheDocument();
  });
});
