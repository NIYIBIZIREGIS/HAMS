import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusBadge } from '../components/appointments/StatusBadge';
import { ScheduleAppointmentModal } from '../components/appointments/ScheduleAppointmentModal';
import { DoctorPatientSummary } from '../components/appointments/DoctorPatientSummary';
import { AppointmentDetailPage } from '../pages/patient/AppointmentDetailPage';
import '../i18n';

const mocks = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  getAppointment: vi.fn(),
  respondToRescheduleProposal: vi.fn(),
  getAppointmentPatientSummary: vi.fn(),
  cancelAppointment: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, ...mocks };
});

const proposedAppointment = {
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
  status: 'Reschedule Proposed',
  proposedDate: '2026-11-09T00:00:00.000Z',
  proposedTimeSlot: '10:30',
  proposedNote: 'Please come later',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Appointment reschedule UI', () => {
  it('renders the proposed status distinctly', () => {
    render(<StatusBadge status="Reschedule Proposed" />);
    expect(screen.getByText('Reschedule proposed')).toBeInTheDocument();
  });

  it('loads available slots and submits the selected proposal', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    mocks.getAvailability.mockResolvedValue([
      { time: '09:15', label: '09:15', capacity: 1, available: 1 },
    ]);

    render(
      <ScheduleAppointmentModal
        open
        mode="propose"
        doctorId="d1"
        initialDate="2026-11-02T00:00:00.000Z"
        onClose={() => undefined}
        onConfirm={onConfirm}
      />
    );

    await user.click(await screen.findByRole('option', { name: '09:15' }));
    await user.type(screen.getByRole('textbox'), 'Please come 15 minutes later');
    await user.click(screen.getByRole('button', { name: /send proposal/i }));

    expect(mocks.getAvailability).toHaveBeenCalledWith('d1', '2026-11-02');
    expect(onConfirm).toHaveBeenCalledWith({
      appointmentDate: '2026-11-02T00:00:00.000Z',
      timeSlot: '09:15',
      note: 'Please come 15 minutes later',
    });
  });

  it('lets the patient accept a proposed time from the appointment detail', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    mocks.getAppointment.mockResolvedValue(proposedAppointment);
    mocks.respondToRescheduleProposal.mockResolvedValue({
      ...proposedAppointment,
      status: 'Confirmed',
      appointmentDate: proposedAppointment.proposedDate,
      timeSlot: proposedAppointment.proposedTimeSlot,
    });

    render(
      <MemoryRouter initialEntries={['/appointments/a1']}>
        <Routes>
          <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Your doctor proposed a new time')).toBeInTheDocument();
    expect(screen.getByText(/10:30/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /accept new time/i }));

    await waitFor(() =>
      expect(mocks.respondToRescheduleProposal).toHaveBeenCalledWith('a1', 'accept', undefined)
    );
  });

  it('shows the doctor the appointment-scoped patient summary', async () => {
    mocks.getAppointmentPatientSummary.mockResolvedValue({
      patient: {
        _id: 'p1',
        patientNumber: 'PT-00001',
        dob: '1990-04-10T00:00:00.000Z',
        gender: 'female',
        bloodGroup: 'O+',
        allergies: ['Penicillin'],
        chronicConditions: ['Asthma'],
        userId: {
          _id: 'u1',
          fullName: 'Aline Patient',
          email: 'aline@example.test',
          phone: '0788000000',
        },
      },
      medicalHistory: [
        {
          _id: 'm1',
          diagnosis: 'Bronchitis',
          symptoms: ['Cough'],
          treatment: 'Rest',
          createdAt: '2026-10-26T00:00:00.000Z',
          doctorId: { _id: 'd1', userId: { fullName: 'Dr. Uwase' } },
        },
      ],
      previousVisits: [
        {
          _id: 'a0',
          appointmentDate: '2026-10-26T00:00:00.000Z',
          timeSlot: '09:00',
          reason: 'Cough',
          status: 'Completed',
          doctorId: { _id: 'd1', userId: { fullName: 'Dr. Uwase' } },
          departmentId: { _id: 'dep1', name: 'General Medicine' },
        },
      ],
      labResults: [
        {
          _id: 'l1',
          testName: 'Chest X-ray',
          status: 'Completed',
          requestedAt: '2026-10-26T00:00:00.000Z',
          result: 'Clear lungs',
          isAbnormal: false,
        },
      ],
      documents: [
        {
          _id: 'doc1',
          title: 'Discharge summary',
          category: 'medical_report',
          fileUrl: 'https://example.test/discharge.pdf',
          createdAt: '2026-10-26T00:00:00.000Z',
        },
      ],
    });

    render(<DoctorPatientSummary appointmentId="a1" />);

    expect(await screen.findByText('Aline Patient')).toBeInTheDocument();
    expect(screen.getByText(/Penicillin/)).toBeInTheDocument();
    expect(screen.getByText('Bronchitis')).toBeInTheDocument();
    expect(screen.getByText('Chest X-ray')).toBeInTheDocument();
    expect(screen.getByText('Discharge summary')).toBeInTheDocument();
  });
});
