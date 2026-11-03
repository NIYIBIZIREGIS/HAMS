import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoctorDashboard } from '../pages/doctor/DoctorDashboard';
import { useAuthStore } from '../store/authStore';
import '../i18n';

const { listAppointmentsPage } = vi.hoisted(() => ({
  listAppointmentsPage: vi.fn(),
}));

vi.mock('../services/api', () => ({
  listAppointmentsPage,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Something went wrong',
}));

function metricValue(label: string): HTMLElement {
  const labelNode = screen.getByText(label);
  return within(labelNode.parentElement as HTMLElement).getByText(/^\d+$/);
}

describe('Doctor dashboard', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'user-1', fullName: 'Dr. Grace', role: 'doctor' },
    });

    listAppointmentsPage.mockImplementation(
      async (params: { status?: string }) => {
        if (params?.status === 'Pending') {
          return { items: [], page: 1, pages: 1, total: 3 };
        }
        if (params?.status === 'Completed') {
          return { items: [], page: 1, pages: 1, total: 4 };
        }
        return {
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
              appointmentDate: '2026-11-03T00:00:00.000Z',
              timeSlot: '09:00',
              visitType: 'new',
              status: 'Confirmed',
            },
            {
              _id: 'appt-2',
              facilityId: 'facility-1',
              patientId: {
                _id: 'patient-1',
                patientNumber: 'PT-00001',
                userId: { fullName: 'Aline Patient' },
              },
              doctorId: 'doctor-1',
              departmentId: { _id: 'dept-1', name: 'General Medicine' },
              appointmentDate: '2026-11-03T00:00:00.000Z',
              timeSlot: '10:00',
              visitType: 'follow-up',
              status: 'In Progress',
            },
          ],
          page: 1,
          pages: 1,
          total: 2,
        };
      },
    );
  });

  it('shows all-time pending requests, this week completions, and unique patients today', async () => {
    render(
      <MemoryRouter>
        <DoctorDashboard />
      </MemoryRouter>,
    );

    await screen.findAllByText('Aline Patient');

    expect(metricValue('Pending requests').textContent).toBe('3');
    expect(metricValue('Completed this week').textContent).toBe('4');
    expect(metricValue("Today's patients").textContent).toBe('1');
  });

  it('links each timeline row to the appointment detail page', async () => {
    render(
      <MemoryRouter>
        <DoctorDashboard />
      </MemoryRouter>,
    );

    await screen.findAllByText('Aline Patient');

    const links = screen
      .getAllByText('Aline Patient')
      .map((node) => node.closest('a'))
      .filter((link): link is HTMLAnchorElement => Boolean(link));

    expect(links[0]).toHaveAttribute('href', '/doctor/appointments/appt-1');
    expect(links[1]).toHaveAttribute('href', '/doctor/appointments/appt-2');
  });
});
