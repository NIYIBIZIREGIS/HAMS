import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { DensityContext, type Density } from './density';

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Rendered in a fixed strip below the scroll area rather than inside it. Long forms used to
   * carry their own action row at the end of the body, which meant "Save" sat below the fold and
   * scrolled away; keeping it here also stops the buttons from eating the scroll height.
   */
  footer?: ReactNode;
  /**
   * Packs every `Input`/`Select` below into the dense treatment. Set this on form modals so the
   * form fits the viewport instead of scrolling.
   */
  density?: Density;
}

const widthClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
  footer,
  density = 'default',
}: ModalProps) {
  const visible = open ?? isOpen ?? false;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <DensityContext.Provider value={density}>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden px-4 pb-3 pt-6"
        onClick={(e) => e.target === overlayRef.current && onClose()}
      >
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
        <div
          className={`relative flex max-h-[calc(100dvh-2.25rem)] w-full flex-col ${widthClasses[width]} rounded-xl border border-slate-200 bg-card shadow-md animate-in fade-in zoom-in-95`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {title && (
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="min-w-0 truncate text-base font-semibold text-text-main">{title}</h2>
              <button
                onClick={onClose}
                className="shrink-0 rounded-xl p-1.5 text-text-muted hover:bg-slate-100 hover:text-text-main"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </DensityContext.Provider>
  );
}
