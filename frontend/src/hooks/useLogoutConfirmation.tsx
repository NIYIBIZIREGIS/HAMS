import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuthStore } from '../store/authStore';

/**
 * Logout is reachable from five places (public navbar, portal header, portal sidebar, admin
 * header, admin sidebar), and each one used to sign the user out the instant it was clicked.
 *
 * On a hospital system that is a genuine hazard rather than a small annoyance: a stray click
 * next to "Back" or "Notifications" ends the session mid-task, and anything half-entered in a
 * form is gone. Losing that work is not obvious until it happens, so the intent to sign out
 * has to be stated.
 *
 * Keeping the dialog here rather than in each call site means all five behave identically —
 * same wording, same Escape and backdrop behaviour — and there is one place to change it.
 */
export function useLogoutConfirmation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Bound to the trigger: shows the prompt instead of signing out. */
  const requestLogout = useCallback(() => setOpen(true), []);

  /**
   * The redirect lives here rather than at each call site. `logout` only clears the session,
   * so leaving this out would drop the user on whichever protected page they happened to be
   * looking at, still rendered, now showing someone else's empty data on the next fetch.
   */
  const confirmLogout = useCallback(async () => {
    setBusy(true);
    try {
      await logout();
      setOpen(false);
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  }, [logout, navigate]);

  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={confirmLogout}
      title={t('nav.logoutConfirmTitle')}
      message={t('nav.logoutConfirmMessage')}
      confirmLabel={t('nav.logoutConfirmAction')}
      cancelLabel={t('nav.logoutConfirmCancel')}
      variant="danger"
      loading={busy}
    />
  );

  return { requestLogout, dialog };
}