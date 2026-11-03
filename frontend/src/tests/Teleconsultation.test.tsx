import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentDetailPage } from '../pages/patient/AppointmentDetailPage';
import { DoctorAppointmentDetailPage } from '../pages/doctor/DoctorAppointmentDetailPage';
import '../i18n';

const mocks = vi.hoisted(() => ({
  getAppointment: vi.fn(),
  getAppointmentPatientSummary: vi.fn(),
  updateAppointmentMeetingLink: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, ...mocks };
});

vi.mock('../components/appointments/DoctorPatientSummary', () => ({
  DoctorPatientSummary: () => null,
}));

const meetingLink = 'https://meet.example.com/consultation-room';

const baseAppointment = {
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
  status: 'Confirmed',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppointmentPatientSummary.mockResolvedValue({});
});

describe('Teleconsultation UI', () => {
  it('shows the meeting link to the patient once the appointment is confirmed', async () => {
    mocks.getAppointment.mockResolvedValue({ ...baseAppointment, meetingLink });

    render(
      <MemoryRouter initialEntries={['/appointments/a1']}>
        <Routes>
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Online consultation')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /join video consultation/i });
    expect(link).toHaveAttribute('href', meetingLink);
  });

  it('does not show a meeting link while the appointment is pending', async () => {
    mocks.getAppointment.mockResolvedValue({
      ...baseAppointment,
      status: 'Pending',
      meetingLink,
    });

    render(
      <MemoryRouter initialEntries={['/appointments/a1']}>
        <Routes>
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Appointment details')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join video consultation/i })).not.toBeInTheDocument();
  });

  it('lets the doctor add a meeting link from the appointment detail', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    mocks.getAppointment.mockResolvedValue(baseAppointment);
    mocks.updateAppointmentMeetingLink.mockResolvedValue({
      ...baseAppointment,
      meetingLink,
    });

    render(
      <MemoryRouter initialEntries={['/doctor/appointments/a1']}>
        <Routes>
          <Route path="/doctor/appointments/:id" element={<DoctorAppointmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /set meeting link/i }));
    await user.type(screen.getByRole('textbox', { name: /meeting link/i }), meetingLink);
    await user.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() =>
      expect(mocks.updateAppointmentMeetingLink).toHaveBeenCalledWith('a1', meetingLink)
    );
  });
});
