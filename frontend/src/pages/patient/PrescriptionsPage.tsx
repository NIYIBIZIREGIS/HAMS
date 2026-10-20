import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listPrescriptionsPage,
  getPrescriptionPdfUrl,
  type Prescription,
} from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Search, Download, Calendar, Stethoscope, Inbox, FileText } from 'lucide-react';

const PAGE_SIZE = 10;

export function PrescriptionsPage() {
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listPrescriptionsPage({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!mounted) return;
        setPrescriptions(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
      })
      .catch(() => mounted && setPrescriptions([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page]);

  const filtered = prescriptions.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const meds = (p.medicines ?? []).map((m) => m.name).join(' ');
    const doc =
      typeof p.doctorId === 'object'
        ? p.doctorId?.userId?.fullName ?? ''
        : '';
    return `${meds} ${doc}`.toLowerCase().includes(q);
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">{t('medicalHistory.prescriptions')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${t('common.search')}...`}
          className="w-full rounded-xl border border-slate-300 bg-card py-2 pl-9 pr-3 text-sm text-text-main placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('medicalHistory.noPrescriptions')}</h3>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const doc = typeof p.doctorId === 'object' ? p.doctorId : null;
            const fac = typeof p.facilityId === 'object' ? p.facilityId : null;
            return (
              <Card key={p._id} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-base font-semibold text-text-main">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="flex items-center gap-2 text-sm text-text-muted">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(p.issuedAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="truncate text-xs font-medium uppercase tracking-wide text-text-muted">
                    {t('medicalHistory.prescription')}
                  </span>
                </div>

                {p.medicines?.length > 0 && (
                  <ul className="space-y-2">
                    {p.medicines.slice(0, 8).map((m, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-text-main">{m.name}</span>
                          {m.instructions && (
                            <span className="block text-xs text-text-muted">{m.instructions}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-right text-xs text-text-muted">
                          {m.dosage} · {m.frequency} · {m.durationDays}d
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {p.medicines?.length > 8 && (
                  <p className="text-xs text-text-muted">+{p.medicines.length - 8}</p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div className="min-w-0 flex items-center gap-3">
                    {doc && (
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Stethoscope className="h-3 w-3 shrink-0" />
                        <span className="truncate">{doc?.userId?.fullName}</span>
                      </span>
                    )}
                    {fac && <span className="shrink-0 text-xs text-text-muted">{fac.name}</span>}
                  </div>
                  <a
                    href={getPrescriptionPdfUrl(p._id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-medium text-primary ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('medicalHistory.downloadPrescription')}
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.prescriptions"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  );
}
