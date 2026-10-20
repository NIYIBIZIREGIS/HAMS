import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('has_theme') as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeClass = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const initial = getInitialTheme();
applyThemeClass(initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('has_theme', next);
      applyThemeClass(next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    localStorage.setItem('has_theme', theme);
    applyThemeClass(theme);
    set({ theme });
  },
}));
