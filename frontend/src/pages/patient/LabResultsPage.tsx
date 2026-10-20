import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listLabTestsPage, type LaboratoryTest } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Search, Download, Calendar, Stethoscope, Inbox, FlaskConical } from 'lucide-react';

const PAGE_SIZE = 10;

const STATUS_TONES: Record<string, string> = {
  Requested: 'bg-primary-50 text-primary-700 border-primary-50',
  'In Progress': 'bg-status-pending-bg text-status-pending-text border-status-pending-bg',
  Completed: 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
};

export function LabResultsPage() {
  const { t } = useTranslation();
  const [tests, setTests] = useState<LaboratoryTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listLabTestsPage({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!mounted) return;
        setTests(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
      })
      .catch(() => mounted && setTests([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page]);

  const filtered = tests.filter((x) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const doc = typeof x.requestedBy === 'object' ? x.requestedBy?.userId?.fullName ?? '' : '';
    return `${x.testName} ${doc}`.toLowerCase().includes(q);
  });

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-main">{t('medicalHistory.labTests')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('medicalHistory.title')}</p>
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
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('medicalHistory.noLabTests')}</h3>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t('medicalHistory.labTests')}</th>
                <th className="px-4 py-3 font-medium">{t('lab.completedAt')}</th>
                <th className="px-4 py-3 font-medium">{t('medicalHistory.prescribedBy')}</th>
                <th className="px-4 py-3 font-medium">{t('lab.result')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((x) => {
                const doc = typeof x.requestedBy === 'object' ? x.requestedBy : null;
                return (
                  <tr key={x._id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                          <FlaskConical className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-text-main">{x.testName}</span>
                          <span
                            className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                              STATUS_TONES[x.status] ?? 'bg-slate-100 text-text-muted border-slate-100'
                            }`}
                          >
                            {x.status}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-text-muted" />
                        {new Date(x.requestedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {doc ? (
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <Stethoscope className="h-3.5 w-3.5 text-text-muted" />
                          {doc?.userId?.fullName}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {x.status === 'Completed' ? (
                        x.resultFileUrl ? (
                          <a
                            href={x.resultFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
                          >
                            <Download className="h-4 w-4" />
                            {t('lab.downloadResult')}
                          </a>
                        ) : (
                          <span className="text-xs text-text-muted">{x.result || t('lab.awaitingResult')}</span>
                        )
                      ) : (
                        <span className="text-xs text-text-muted">{t('lab.awaitingResult')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.labResults"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  );
}
