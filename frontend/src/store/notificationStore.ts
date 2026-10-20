import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'appointment' | 'system' | 'prescription' | 'message';
  title: string;
  message: string;
  time: string;
  read: boolean;
  to?: string;
}

interface NotificationsState {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'time'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const seed: Omit<AppNotification, 'id' | 'read'>[] = [
  {
    type: 'appointment',
    title: 'Appointment confirmed',
    message: 'Your appointment with Dr. Uwera for tomorrow at 09:00 has been confirmed.',
    time: '2 hours ago',
    to: '/appointments',
  },
  {
    type: 'prescription',
    title: 'Prescription issued',
    message: 'Dr. Mugisha issued a new prescription. You can view it in your medical history.',
    time: '1 day ago',
    to: '/medical-history',
  },
  {
    type: 'system',
    title: 'Welcome to HAS',
    message: 'Thank you for using the Hospital Appointments Management System.',
    time: '3 days ago',
  },
];

export const useNotificationStore = create<NotificationsState>((set) => ({
  notifications: seed.map((s, i) => ({ ...s, id: `n${i}`, read: false })),

  addNotification: (n) =>
    set((state) => ({
      notifications: [
        { ...n, id: `n${Date.now()}`, read: false, time: 'Just now' },
        ...state.notifications,
      ],
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  clear: () => set({ notifications: [] }),
}));