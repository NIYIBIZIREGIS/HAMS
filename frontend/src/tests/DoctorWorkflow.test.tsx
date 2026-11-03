import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DeclineAppointmentModal } from '../components/appointments/DeclineAppointmentModal';
import { StatusBadge } from '../components/appointments/StatusBadge';
import { DoctorAppointmentsPage } from '../pages/doctor/DoctorAppointmentsPage';
import '../i18n';

const { listAppointmentsPage } = vi.hoisted(() => ({
  listAppointmentsPage: vi.fn(),
}));

vi.mock('../services/api', () => ({
  listAppointmentsPage,
  acceptAppointment: vi.fn(),
  declineAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  proposeReschedule: vi.fn(),
  rescheduleAppointment: vi.fn(),
}));

describe('Doctor appointment workflow UI', () => {
  it('requires a typed reason when the preset is "Other"', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeclineAppointmentModal
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
        patientName="Aline Patient"
      />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'other');
    expect(screen.getByRole('button', { name: /decline appointment/i })).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'Doctor is on emergency leave');
    await user.click(screen.getByRole('button', { name: /decline appointment/i }));

    expect(onConfirm).toHaveBeenCalledWith('Doctor is on emergency leave');
  }, 20000);

  it('submits a preset reason with optional details', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeclineAppointmentModal
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
      />
    );

    await user.selectOptions(screen.getByRole('combobox'), 'scheduleConflict');
    await user.type(screen.getByRole('textbox'), 'Overlaps with theatre list');
    await user.click(screen.getByRole('button', { name: /decline appointment/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      'Schedule conflict: Overlaps with theatre list'
    );
  });

  it('renders the declined status distinctly', () => {
    render(<StatusBadge status="Declined" />);
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('shows the appointment type column in the doctor queue', async () => {
    listAppointmentsPage.mockResolvedValue({
      items: [
        {
          _id: 'a1',
          facilityId: 'f1',
          patientId: {
            _id: 'p1',
            patientNumber: 'PT-00001',
            userId: { fullName: 'Aline Patient' },
          },
          doctorId: 'd1',
          departmentId: { _id: 'dep1', name: 'General Medicine' },
          appointmentDate: '2026-11-02T00:00:00.000Z',
          timeSlot: '09:00',
          reason: 'Persistent headache',
          visitType: 'follow-up',
          status: 'Pending',
        },
      ],
      page: 1,
      pages: 1,
      total: 1,
    });

    render(
      <MemoryRouter>
        <DoctorAppointmentsPage />
      </MemoryRouter>
    );

    await screen.findByText('Aline Patient');

    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toContain('Type');
    expect(screen.getByText('follow-up')).toBeInTheDocument();
  });
});
