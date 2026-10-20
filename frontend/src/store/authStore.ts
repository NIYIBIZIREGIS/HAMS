import { create } from 'zustand';
import { User, VerificationResponse } from '../services/auth';
import { setTokens, clearTokens } from '../services/client';
import * as authService from '../services/auth';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User) => void;
  login: (email: string, password: string) => Promise<User>;
  loginWithNationalId: (nationalId: string, password: string) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    nationalId?: string;
  }) => Promise<User>;
  verifyOtpLogin: (email: string, otp: string) => Promise<User>;
  sendEmailCode: (email?: string) => Promise<VerificationResponse>;
  verifyEmailCode: (code: string, email?: string) => Promise<User>;
  sendPhoneCode: (phone?: string) => Promise<VerificationResponse>;
  verifyPhoneCode: (code: string, phone?: string) => Promise<User>;
  updateProfileImage: (image: string | null) => Promise<User>;
  logout: () => Promise<void>;
}

const cachedUser = (() => {
  try {
    const raw = localStorage.getItem('has_user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>((set) => ({
  user: cachedUser,
  loading: false,

  setUser: (user) => {
    localStorage.setItem('has_user', JSON.stringify(user));
    set({ user });
  },

  updateProfileImage: async (image) => {
    const user = await authService.updateProfileImage(image);
    localStorage.setItem('has_user', JSON.stringify(user));
    set({ user });
    return user;
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const data = await authService.login(email, password);
      setTokens(data.tokens);
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  loginWithNationalId: async (nationalId, password) => {
    set({ loading: true });
    try {
      const data = await authService.loginWithNationalId(nationalId, password);
      setTokens(data.tokens);
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (payload) => {
    set({ loading: true });
    try {
      const data = await authService.register(payload);
      setTokens(data.tokens);
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  verifyOtpLogin: async (email, otp) => {
    set({ loading: true });
    try {
      const data = await authService.verifyOtp(email, otp);
      setTokens(data.tokens);
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user, loading: false });
      return data.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  sendEmailCode: async (email) => {
    return authService.sendEmailVerification(email);
  },

  verifyEmailCode: async (code, email) => {
    const data = await authService.verifyEmail(code, email);
    if (data.user) {
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user });
    }
    return data.user as User;
  },

  sendPhoneCode: async (phone) => {
    return authService.sendPhoneVerification(phone);
  },

  verifyPhoneCode: async (code, phone) => {
    const data = await authService.verifyPhone(code, phone);
    if (data.user) {
      localStorage.setItem('has_user', JSON.stringify(data.user));
      set({ user: data.user });
    }
    return data.user as User;
  },

  logout: async () => {
    const refresh = localStorage.getItem('has_refresh_token');
    if (refresh) {
      try {
        await authService.logout(refresh);
      } catch {
        // ignore network errors on logout
      }
    }
    clearTokens();
    localStorage.removeItem('has_user');
    set({ user: null });
  },
}));
