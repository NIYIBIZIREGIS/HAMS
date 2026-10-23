import { client } from './client';

export interface User {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  role: string;
  facilityId?: string | null;
  status?: string;
  preferredLanguage?: string;
  profileImageUrl?: string;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  /** True while the account still holds a platform-issued temporary password. */
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  patientNumber?: string;
  otp?: string;
  delivered?: boolean;
  via?: string;
  notice?: string;
  message?: string;
}

export interface VerificationResponse {
  user?: User;
  otp?: string;
  delivered?: boolean;
  via?: string;
  notice?: string;
  message?: string;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login', { email, password });
  return res.data.data as AuthResponse;
}

export async function loginWithNationalId(nationalId: string, password: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login/national-id', { nationalId, password });
  return res.data.data as AuthResponse;
}

export async function register(payload: {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  nationalId?: string;
}): Promise<AuthResponse> {
  const res = await client.post('/auth/register', payload);
  return res.data.data as AuthResponse;
}

export async function requestOtp(email: string): Promise<AuthResponse> {
  const res = await client.post('/auth/otp/request', { email });
  return res.data.data as AuthResponse;
}

export async function verifyOtp(email: string, otp: string): Promise<AuthResponse> {
  const res = await client.post('/auth/otp/verify', { email, otp });
  return res.data.data as AuthResponse;
}

export async function forgotPassword(email: string): Promise<AuthResponse> {
  const res = await client.post('/auth/forgot-password', { email });
  return res.data.data as AuthResponse;
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const res = await client.post('/auth/reset-password', { email, otp, newPassword });
  return res.data.data as AuthResponse;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
  const res = await client.post('/auth/change-password', { currentPassword, newPassword });
  return res.data.data as AuthResponse;
}

export async function updateProfileImage(image: string | null): Promise<User> {
  const res = await client.put('/auth/profile-image', { image });
  return res.data.data.user as User;
}

export async function updateProfile(payload: { fullName?: string; phone?: string }): Promise<User> {
  const res = await client.put('/auth/profile', payload);
  return res.data.data.user as User;
}

export async function logout(refreshToken: string) {
  await client.post('/auth/logout', { refreshToken });
}

export async function sendEmailVerification(email?: string): Promise<VerificationResponse> {
  const res = await client.post('/auth/verify/email/send', email ? { email } : {});
  return res.data.data as VerificationResponse;
}

export async function verifyEmail(code: string, email?: string): Promise<VerificationResponse> {
  const res = await client.post('/auth/verify/email/confirm', { code, ...(email ? { email } : {}) });
  return res.data.data as VerificationResponse;
}

export async function sendPhoneVerification(phone?: string): Promise<VerificationResponse> {
  const res = await client.post('/auth/verify/phone/send', phone ? { phone } : {});
  return res.data.data as VerificationResponse;
}

export async function verifyPhone(code: string, phone?: string): Promise<VerificationResponse> {
  const res = await client.post('/auth/verify/phone/confirm', { code, ...(phone ? { phone } : {}) });
  return res.data.data as VerificationResponse;
}
