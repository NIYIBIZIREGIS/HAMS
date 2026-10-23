import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'appointment' | 'system' | 'prescription' | 'message' | 'lab_result' | 'billing' | 'general';
  title: string;
  message: string;
  time: string;
  read: boolean;
  to?: string;
}

interface NotificationsState {
  notifications: AppNotification[];
  setNotifications: (n: AppNotification[]) => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'time'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationsState>((set) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications }),

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