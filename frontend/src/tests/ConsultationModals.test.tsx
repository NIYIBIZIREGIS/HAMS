import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FollowUpModal } from '../components/appointments/FollowUpModal';
import { ReferralModal } from '../components/appointments/ReferralModal';
import '../i18n';

const { getAvailability, listDoctors } = vi.hoisted(() => ({
  getAvailability: vi.fn(),
  listDoctors: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getAvailability,
  listDoctors,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Something went wrong',
}));

describe('Consultation follow-up and referral dialogs', () => {
  it('books a confirmed follow-up from a free slot', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    getAvailability.mockResolvedValue([
      { time: '09:00', label: '09:00', capacity: 1, available: 1 },
    ]);

    render(
      <FollowUpModal
        open
        doctorId="doctor-1"
        initialDate="2026-11-02T00:00:00.000Z"
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    await user.click(await screen.findByRole('option', { name: '09:00' }));
    await user.type(
      screen.getByRole('textbox'),
      'Review blood pressure and medication response',
    );
    await user.click(screen.getByRole('button', { name: /book follow-up/i }));

    expect(getAvailability).toHaveBeenCalledWith('doctor-1', '2026-11-02');
    expect(onConfirm).toHaveBeenCalledWith({
      appointmentDate: '2026-11-02T00:00:00.000Z',
      timeSlot: '09:00',
      note: 'Review blood pressure and medication response',
      autoConfirm: true,
    });
  }, 20000);

  it('can leave a follow-up pending for patient confirmation', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    getAvailability.mockResolvedValue([
      { time: '10:30', label: '10:30', capacity: 1, available: 1 },
    ]);

    render(
      <FollowUpModal
        open
        doctorId="doctor-1"
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    await user.click(await screen.findByRole('option', { name: '10:30' }));
    await user.click(
      screen.getByRole('checkbox', { name: /confirm automatically/i }),
    );
    await user.click(screen.getByRole('button', { name: /book follow-up/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ timeSlot: '10:30', autoConfirm: false }),
    );
  }, 20000);

  it('sends a referral with an optional pending appointment', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    listDoctors.mockResolvedValue([
      {
        _id: 'doctor-2',
        userId: { _id: 'user-2', fullName: 'Dr. Patrick Cardiologist' },
        facilityId: 'facility-1',
        departmentId: [{ _id: 'dept-1', name: 'Cardiology' }],
        specialization: ['Cardiology'],
      },
    ]);
    getAvailability.mockResolvedValue([
      { time: '11:00', label: '11:00', capacity: 1, available: 1 },
    ]);

    render(
      <ReferralModal
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => expect(listDoctors).toHaveBeenCalled());
    await user.selectOptions(
      await screen.findByRole('combobox'),
      'doctor-2',
    );
    await user.type(
      screen.getByRole('textbox'),
      'Persistent chest pain with abnormal ECG',
    );
    await user.click(
      screen.getByRole('checkbox', { name: /create a pending appointment/i }),
    );
    await user.click(await screen.findByRole('option', { name: '11:00' }));
    await user.click(screen.getByRole('button', { name: /send referral/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      targetDoctorId: 'doctor-2',
      note: 'Persistent chest pain with abnormal ECG',
      appointmentDate: expect.any(String),
      timeSlot: '11:00',
    });
  }, 20000);
});
