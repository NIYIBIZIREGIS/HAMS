import { useState, type FormEvent } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { changePassword } from '../../services/auth';
import { getErrorMessage } from '../../services/client';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function ForcePasswordChange() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user?.mustChangePassword) return null;

  const validate = (): string | null => {
    if (!currentPassword) return 'Enter your temporary password';
    if (newPassword.length < 6) return 'New password must be at least 6 characters';
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) {
      return 'Use at least one letter, one number and one symbol';
    }
    if (newPassword === currentPassword) return 'New password must differ from the temporary one';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await changePassword(currentPassword, newPassword);
      setUser({ ...res.user, mustChangePassword: false });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-xl font-bold text-slate-900 font-display dark:text-white">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          You are signed in with a temporary password issued by the platform administrator.
          Set a private password to continue.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Input
            label="Temporary password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            icon={KeyRound}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="At least 6 characters with a letter, a number and a symbol"
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" loading={busy} className="w-full justify-center">
            Save password and continue
          </Button>
        </form>

        <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Signed in as {user.email ?? user.fullName}
        </p>
      </div>
    </div>
  );
}
