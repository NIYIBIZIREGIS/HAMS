import { createPortal } from 'react-dom';
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

  // Portalled to <body>: every call site renders this inside a layout header or sidebar, and
  // those ancestors carry `backdrop-blur`, z-index stacking contexts and fixed positioning —
  // which trap a plain `position: fixed` overlay and clip it so the dialog never appears.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-hidden pt-4 sm:items-start sm:px-4 sm:pb-3 sm:pt-6">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-slate-200 bg-card shadow-md max-h-[calc(100dvh-1rem)] animate-modal-in sm:max-h-[calc(100dvh-2.25rem)]"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="shrink-0 px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-status-cancelled-bg sm:mb-4 sm:h-12 sm:w-12">
            <AlertTriangle className="h-5 w-5 text-status-cancelled-text sm:h-6 sm:w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-main">{title}</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-2 sm:px-6">
          <p className="text-sm text-text-muted">{message}</p>
        </div>
        <div className="flex shrink-0 flex-row justify-end gap-2 px-4 pb-4 pt-2 sm:gap-3 sm:px-6 sm:pb-6 sm:pt-4 [&>*]:w-auto">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
