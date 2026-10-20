import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
  /** Noun for the row count line, e.g. `resultsLabel`. */
  itemLabel?: string;
  disabled?: boolean;
}

/**
 * Page numbers to render, collapsing to `…` once the list is long enough that showing every
 * page would overflow the row. Shared by the list tables that paginate in the browser.
 */
export function pageWindow(page: number, pages: number): Array<number | 'gap'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set<number>([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const sorted = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('gap');
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * Page controls for a server-paginated list.
 *
 * Every list endpoint sends `meta`, but the pages previously fetched everything and filtered in
 * the browser, so they had no way to know whether more rows existed. This renders nothing when
 * there is only one page so short lists keep their original layout.
 */
export function Pagination({ page, pages, total, onChange, itemLabel, disabled }: Props) {
  const { t } = useTranslation();
  if (pages <= 1) return null;

  const isFirst = page <= 1;
  const isLast = page >= pages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-text-muted dark:text-slate-400">
        {itemLabel
          ? t('pagination.showing', { count: total, label: t(itemLabel) })
          : t('pagination.total', { count: total })}
        <span className="ml-2">{t('common.pageOf', { page, pages })}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={disabled || isFirst}
          aria-label={t('common.previous')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-card text-text-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={disabled || isLast}
          aria-label={t('common.next')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-card text-text-muted transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
