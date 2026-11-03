import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DoctorCalendarPage } from '../pages/doctor/DoctorCalendarPage';
import '../i18n';

const { getMyDoctorProfile, getDoctorSchedule, listAppointmentsPage } = vi.hoisted(() => ({
  getMyDoctorProfile: vi.fn(),
  getDoctorSchedule: vi.fn(),
  listAppointmentsPage: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getMyDoctorProfile,
  getDoctorSchedule,
  listAppointmentsPage,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Something went wrong',
}));

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorCalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Doctor calendar', () => {
  it('combines weekly availability with appointment links', async () => {
    const today = new Date();
    getMyDoctorProfile.mockResolvedValue({
      _id: 'doctor-1',
      userId: { _id: 'user-1', fullName: 'Dr. Grace' },
      facilityId: 'facility-1',
      departmentId: [{ _id: 'dept-1', name: 'General Medicine' }],
      specialization: ['General Medicine'],
    });
    getDoctorSchedule.mockResolvedValue([
      {
        _id: 'schedule-1',
        doctorId: 'doctor-1',
        dayOfWeek: today.getDay(),
        startTime: '09:00',
        endTime: '12:00',
        slotDurationMinutes: 30,
        maxPatientsPerSlot: 1,
        isActive: true,
      },
    ]);
    listAppointmentsPage.mockResolvedValue({
      items: [
        {
          _id: 'appt-1',
          facilityId: 'facility-1',
          patientId: {
            _id: 'patient-1',
            patientNumber: 'PT-00001',
            userId: { fullName: 'Aline Patient' },
          },
          doctorId: 'doctor-1',
          departmentId: { _id: 'dept-1', name: 'General Medicine' },
          appointmentDate: `${localDateKey(today)}T00:00:00.000Z`,
          timeSlot: '10:30',
          visitType: 'new',
          status: 'Confirmed',
        },
      ],
      page: 1,
      pages: 1,
      total: 1,
    });

    renderCalendar();

    expect(await screen.findByText('Aline Patient')).toBeInTheDocument();
    expect(screen.getByText('09:00-12:00')).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('Aline Patient').closest('a')).toHaveAttribute(
      'href',
      '/doctor/appointments/appt-1',
    );
  });

  it('renders an empty month without dropping the availability legend', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    getMyDoctorProfile.mockResolvedValue({
      _id: 'doctor-1',
      userId: { _id: 'user-1', fullName: 'Dr. Grace' },
      facilityId: 'facility-1',
      departmentId: [{ _id: 'dept-1', name: 'General Medicine' }],
      specialization: ['General Medicine'],
    });
    getDoctorSchedule.mockResolvedValue([]);
    listAppointmentsPage.mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
      total: 0,
    });

    renderCalendar();

    await user.click(await screen.findByRole('button', { name: 'Month' }));

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Appointment')).toBeInTheDocument();
  }, 20000);
});
