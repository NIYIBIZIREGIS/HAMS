import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsultationChatModal } from '../components/appointments/ConsultationChatModal';
import '../i18n';

const { getAppointmentChat, sendAppointmentChatMessage } = vi.hoisted(() => ({
  getAppointmentChat: vi.fn(),
  sendAppointmentChatMessage: vi.fn(),
}));

vi.mock('../services/api', () => ({
  getAppointmentChat,
  sendAppointmentChatMessage,
}));

function renderChat() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConsultationChatModal
        open
        appointmentId="appointment-1"
        patientName="Aline Patient"
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe('Consultation chat', () => {
  beforeEach(() => {
    getAppointmentChat.mockResolvedValue({ threadId: null, messages: [] });
    sendAppointmentChatMessage.mockReset();
  });

  it('sends a message and shows it in the conversation', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();

    renderChat();

    expect(await screen.findByText(/no messages yet/i)).toBeInTheDocument();

    sendAppointmentChatMessage.mockResolvedValue({
      _id: 'message-1',
      facilityId: 'facility-1',
      patientId: 'patient-1',
      appointmentId: 'appointment-1',
      senderName: 'Dr. Grace',
      subject: 'Consultation chat',
      body: 'Please take the medicine after meals.',
      isRead: false,
      createdAt: '2026-11-04T08:00:00.000Z',
      threadId: 'message-1',
      direction: 'to_patient',
    });
    getAppointmentChat.mockResolvedValue({
      threadId: 'message-1',
      messages: [
        {
          _id: 'message-1',
          facilityId: 'facility-1',
          patientId: 'patient-1',
          appointmentId: 'appointment-1',
          senderName: 'Dr. Grace',
          subject: 'Consultation chat',
          body: 'Please take the medicine after meals.',
          isRead: false,
          createdAt: '2026-11-04T08:00:00.000Z',
          threadId: 'message-1',
          direction: 'to_patient',
        },
      ],
    });

    await user.type(
      screen.getByRole('textbox'),
      'Please take the medicine after meals.',
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() =>
      expect(sendAppointmentChatMessage).toHaveBeenCalledWith(
        'appointment-1',
        'Please take the medicine after meals.',
      ),
    );
    expect(
      await screen.findByText('Please take the medicine after meals.'),
    ).toBeInTheDocument();
  }, 20000);

  it('renders both sides of an existing consultation conversation', async () => {
    getAppointmentChat.mockResolvedValue({
      threadId: 'message-1',
      messages: [
        {
          _id: 'message-1',
          facilityId: 'facility-1',
          patientId: 'patient-1',
          appointmentId: 'appointment-1',
          senderName: 'Dr. Grace',
          subject: 'Consultation chat',
          body: 'How are you feeling today?',
          isRead: true,
          createdAt: '2026-11-04T08:00:00.000Z',
          threadId: 'message-1',
          direction: 'to_patient',
        },
        {
          _id: 'message-2',
          facilityId: 'facility-1',
          patientId: 'patient-1',
          appointmentId: 'appointment-1',
          senderName: 'Aline Patient',
          subject: 'Consultation chat',
          body: 'Much better, thank you.',
          isRead: true,
          createdAt: '2026-11-04T08:02:00.000Z',
          threadId: 'message-1',
          direction: 'to_staff',
        },
      ],
    });

    renderChat();

    expect(await screen.findByText('How are you feeling today?')).toBeInTheDocument();
    expect(screen.getByText('Much better, thank you.')).toBeInTheDocument();
    expect(screen.getByText('Aline Patient')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  }, 20000);
});
