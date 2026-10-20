import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden px-4 pb-4 pt-10">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-slate-200 bg-card shadow-md max-h-[calc(100dvh-3.5rem)]"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="shrink-0 px-6 pt-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-cancelled-bg">
            <AlertTriangle className="h-6 w-6 text-status-cancelled-text" />
          </div>
          <h3 className="text-base font-semibold text-text-main">{title}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2 pt-2">
          <p className="text-sm text-text-muted">{message}</p>
        </div>
        <div className="flex shrink-0 justify-end gap-3 px-6 pb-6 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
