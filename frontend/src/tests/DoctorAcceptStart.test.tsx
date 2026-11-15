import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorAppointmentDetailPage } from '../pages/doctor/DoctorAppointmentDetailPage';
import '../i18n';

const mocks = vi.hoisted(() => ({
  getAppointment: vi.fn(),
  acceptAppointment: vi.fn(),
  startConsultation: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, ...mocks };
});

vi.mock('../components/appointments/DoctorPatientSummary', () => ({
  DoctorPatientSummary: () => null,
}));

const pendingAppointment = {
  _id: 'a1',
  facilityId: 'f1',
  patientId: {
    _id: 'p1',
    patientNumber: 'PT-00001',
    userId: { fullName: 'Aline Patient' },
  },
  doctorId: { _id: 'd1', userId: { fullName: 'Dr. Uwase' } },
  departmentId: { _id: 'dep1', name: 'General Medicine' },
  appointmentDate: '2026-11-02T00:00:00.000Z',
  timeSlot: '09:00',
  reason: 'Persistent headache',
  visitType: 'new',
  status: 'Pending',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppointment.mockResolvedValue(pendingAppointment);
  mocks.acceptAppointment.mockResolvedValue({ ...pendingAppointment, status: 'Confirmed' });
  mocks.startConsultation.mockResolvedValue({ ...pendingAppointment, status: 'In Progress' });
});

describe('Doctor appointment confirmation', () => {
  it('confirms, starts the consultation, and opens the consultation screen', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/doctor/appointments/a1']}>
        <Routes>
          <Route path="/doctor/appointments/:id" element={<DoctorAppointmentDetailPage />} />
          <Route path="/consultation/:appointmentId" element={<div>Consultation workspace</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /^accept$/i }));

    await waitFor(() => expect(mocks.acceptAppointment).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(mocks.startConsultation).toHaveBeenCalledWith('a1'));

    expect(mocks.acceptAppointment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startConsultation.mock.invocationCallOrder[0]
    );
    expect(await screen.findByText('Consultation workspace')).toBeInTheDocument();
  });
});
