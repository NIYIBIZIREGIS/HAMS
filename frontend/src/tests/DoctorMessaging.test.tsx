import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AskPatientModal } from '../components/appointments/AskPatientModal';
import { MessagesPage } from '../pages/patient/MessagesPage';
import { useAuthStore } from '../store/authStore';
import '../i18n';

const { listMessageThreads, getMessageThread, replyToThread } = vi.hoisted(() => ({
  listMessageThreads: vi.fn(),
  getMessageThread: vi.fn(),
  replyToThread: vi.fn(),
}));

vi.mock('../services/api', () => ({
  listMessageThreads,
  getMessageThread,
  replyToThread,
}));

describe('Doctor messaging', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'user-1', fullName: 'Dr. Grace', role: 'doctor' },
    });

    listMessageThreads.mockResolvedValue({
      items: [
        {
          threadId: 'thread-1',
          subject: 'Check-in details',
          lastBody: 'Please arrive 15 minutes early.',
          lastSenderName: 'Dr. Grace',
          lastDirection: 'to_patient',
          lastMessageAt: '2026-11-03T08:00:00.000Z',
          messageCount: 1,
          unreadCount: 0,
        },
      ],
      page: 1,
      pages: 1,
      total: 1,
    });

    getMessageThread.mockResolvedValue([
      {
        _id: 'message-1',
        facilityId: 'facility-1',
        patientId: 'patient-1',
        senderName: 'Dr. Grace',
        subject: 'Check-in details',
        body: 'Please arrive 15 minutes early.',
        isRead: true,
        createdAt: '2026-11-03T08:00:00.000Z',
        threadId: 'thread-1',
        direction: 'to_patient',
      },
    ]);
  });

  it('treats a doctor’s outgoing message as their own side of the conversation', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();

    render(<MessagesPage />);

    await user.click(
      await screen.findByRole('button', { name: /check-in details/i }),
    );

    expect(
      (await screen.findAllByText('Please arrive 15 minutes early.')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(getMessageThread).toHaveBeenCalledWith('thread-1');
  }, 20000);

  it('sends a secure question from the appointment detail dialog', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <AskPatientModal
        open
        patientName="Aline Patient"
        defaultSubject="Question about your appointment on 3 Nov 2026"
        onClose={() => undefined}
        onSend={onSend}
      />,
    );

    expect(screen.getByText(/aline patient/i)).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: /message/i }),
      'Could you bring your previous lab results?',
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith(
        'Question about your appointment on 3 Nov 2026',
        'Could you bring your previous lab results?',
      ),
    );
  }, 20000);
});
