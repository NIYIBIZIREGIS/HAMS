import type { ReactNode } from 'react';

interface AuthShellProps {
  image: string;
  imageAlt: string;
  /**
   * Kept so callers do not have to change, but no longer rendered: the photographic panel is
   * now a bare image. `headline`, `subline` and `panel` are all unused for the same reason.
   */
  headline?: string;
  subline?: string;
  panel?: ReactNode;
  reverse?: boolean;
  children: ReactNode;
}

/**
 * Split layout for the sign-in screens: photograph on one side, form on the other.
 *
 * The photo panel is intentionally bare. It carries no text, no icon tiles and no brand
 * block, so the scrim is a light tint rather than the near-opaque navy it needed when white
 * type sat on top of it. Keeping the image visible is the whole point of the panel; burying
 * it under an opaque overlay was buying contrast for text that is no longer there.
 *
 * The form column still paints its own surface (`bg-white` / `dark:bg-slate-950`) instead of
 * the `bg-surface` token, which resolves to a hard-coded light hex and therefore never
 * responded to the dark theme.
 */
export function AuthShell({
  image,
  imageAlt,
  reverse = false,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4.0625rem)] flex-col overflow-y-auto lg:h-[calc(100dvh-4.0625rem)] lg:flex-row lg:overflow-hidden">
      <div className="relative h-40 shrink-0 overflow-hidden lg:hidden">
        <img src={image} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-950/25" />
      </div>

      <div
        className={`relative hidden shrink-0 overflow-hidden lg:block lg:w-[44%] xl:w-1/2 ${
          reverse ? 'lg:order-2' : ''
        }`}
      >
        <img src={image} alt={imageAlt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-950/20" />
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-5 py-8 sm:px-8 dark:bg-slate-950 lg:overflow-y-auto lg:px-10">
        <div className="auth-stack w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
