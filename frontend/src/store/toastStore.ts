import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string, title?: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, title, duration) => {
    const id = nextId++;
    const ms = duration ?? (kind === 'error' ? 6000 : 4000);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, title, duration: ms }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().push('success', message, title),
  error: (message: string, title?: string) =>
    useToastStore.getState().push('error', message, title),
  info: (message: string, title?: string) =>
    useToastStore.getState().push('info', message, title),
};