import { create } from 'zustand';
import {
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification as ApiNotification,
} from '../services/api';

export interface AppNotification {
  id: string;
  type: 'appointment' | 'system' | 'prescription' | 'message' | 'lab_result' | 'billing' | 'general';
  title: string;
  message: string;
  time: string;
  read: boolean;
  to?: string;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapNotification(n: ApiNotification): AppNotification {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.body,
    time: formatTime(n.createdAt),
    read: n.isRead,
    to: n.link,
  };
}

interface NotificationsState {
  notifications: AppNotification[];
  loading: boolean;
  loadNotifications: () => Promise<void>;
  setNotifications: (n: AppNotification[]) => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'time'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  loading: false,

  loadNotifications: async () => {
    set({ loading: true });
    try {
      const page = await listNotificationsPage({ limit: 50 });
      set({ notifications: page.items.map(mapNotification), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setNotifications: (notifications) => set({ notifications }),

  addNotification: (n) =>
    set((state) => ({
      notifications: [
        { ...n, id: `n${Date.now()}`, read: false, time: 'Just now' },
        ...state.notifications,
      ],
    })),

  markRead: (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    void markNotificationRead(id).catch(() => undefined);
  },

  markAllRead: () => {
    const hasUnread = get().notifications.some((n) => !n.read);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    if (hasUnread) void markAllNotificationsRead().catch(() => undefined);
  },

  clear: () => set({ notifications: [] }),
}));
