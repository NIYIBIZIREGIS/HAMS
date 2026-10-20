import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';

/**
 * A full-screen image viewer, in the spirit of the social-media lightbox.
 *
 * Uploaded profile photos are reviewed before they are saved — a clinic admin is checking that
 * the right person is in the picture and that it is actually legible. At thumbnail size in a
 * form row that is impossible to judge, so the image opens full-screen where it can be
 * magnified and inspected.
 *
 * It behaves like the viewer people already have muscle memory for: Escape or the backdrop
 * closes it, the arrow keys pan a zoomed image, and the zoom controls sit in the corners out
 * of the way. Focus moves into the dialog on open and returns to the trigger on close, and the
 * background is inert to screen readers while it is up.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;
/** How far one arrow-key press moves a zoomed image, as a fraction of the overflow. */
const PAN_STEP = 0.2;

interface Props {
  open: boolean;
  src: string | null | undefined;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ open, src, alt = '', onClose }: Props) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((current) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((current + delta).toFixed(2))));
      // Back at 100% there is nothing to pan, so recentre rather than leaving it stranded.
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setScale((current) => {
      if (current === MIN_SCALE) return current;
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      return current;
    });
  }, []);

  // Open on a fresh image: reopening the same photo at the previous zoom reads as stuck.
  useEffect(() => {
    if (open) reset();
  }, [open, src, reset]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          panBy(-PAN_STEP * 100, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          panBy(PAN_STEP * 100, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          panBy(0, -PAN_STEP * 100);
          break;
        case 'ArrowDown':
          e.preventDefault();
          panBy(0, PAN_STEP * 100);
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomBy(SCALE_STEP);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomBy(-SCALE_STEP);
          break;
        case '0':
          e.preventDefault();
          reset();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling under the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose, panBy, zoomBy, reset]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={alt || 'Image preview'}
        className="relative flex max-h-full w-full max-w-5xl flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-SCALE_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <Minus className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-14 text-center text-sm font-medium text-white" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(SCALE_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={scale === MIN_SCALE}
            aria-label="Reset zoom"
            className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-40"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close image preview"
            className="ml-2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-150"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps an image thumbnail so clicking it opens the viewer.
 *
 * Kept separate from `UserAvatar` on purpose: avatars are decorative at most sizes, and making
 * every 32px avatar in a table row open a full-screen overlay would be noise. Opting in per
 * placement keeps the affordance where someone is actually reviewing a photo.
 */
export function ZoomableImage({
  src,
  alt,
  children,
  className = '',
}: {
  src: string | null | undefined;
  alt?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!src) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `Enlarge ${alt}` : 'Enlarge image'}
        title="Click to view full screen"
        className={`cursor-zoom-in rounded-full transition-shadow hover:ring-2 hover:ring-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        {children}
      </button>
      <ImageLightbox open={open} src={src} alt={alt} onClose={() => setOpen(false)} />
    </>
  );
}