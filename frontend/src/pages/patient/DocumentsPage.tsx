import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listPatientDocumentsPage, type PatientDocument, type DocumentCategory } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { Search, Download, FileText, FilePlus2, Inbox, FolderOpen, Calendar, Upload } from 'lucide-react';

const PAGE_SIZE = 10;

const CATEGORY_TONES: Record<string, string> = {
  prescription: 'bg-status-confirmed-bg text-status-confirmed-text border-status-confirmed-bg',
  lab_result: 'bg-primary-50 text-primary-700 border-primary-50',
  medical_report: 'bg-primary-50 text-primary-700 border-primary-50',
  billing_receipt: 'bg-status-pending-bg text-status-pending-text border-status-pending-bg',
  general: 'bg-surface text-text-muted border-slate-200',
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  prescription: FilePlus2,
  lab_result: FileText,
  medical_report: FileText,
  billing_receipt: FileText,
  general: FolderOpen,
};

export function DocumentsPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | DocumentCategory>('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Category is filtered on the server so the counts stay honest across pages.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listPatientDocumentsPage({
      page,
      limit: PAGE_SIZE,
      ...(category === 'all' ? {} : { category }),
    })
      .then((result) => {
        if (!mounted) return;
        setDocuments(result.items);
        setPages(result.pages);
        setPage(result.page);
        setTotal(result.total);
      })
      .catch(() => mounted && setDocuments([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [page, category]);

  const categories: Array<'all' | DocumentCategory> = ['all', 'prescription', 'lab_result', 'medical_report', 'billing_receipt', 'general'];

  const filtered = documents.filter((d) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const uploader =
      typeof d.uploadedBy === 'object' && d.uploadedBy ? d.uploadedBy?.fullName ?? '' : '';
    return `${d.title} ${d.fileName} ${uploader}`.toLowerCase().includes(q);
  });

  const formatBytes = (n?: number) => {
    if (n == null) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-main">{t('documents.title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('documents.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t('common.search')}...`}
            className="w-full rounded-xl border border-slate-300 bg-card py-2 pl-9 pr-3 text-sm text-text-main placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
                onClick={() => {
                  setCategory(c);
                  setPage(1);
                }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === c
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 bg-card text-text-muted hover:bg-slate-50 hover:text-text-main'
              }`}
            >
              {t(`documents.categories.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-12 w-12 text-text-muted/40" />
          <h3 className="mt-4 text-base font-semibold text-text-main">{t('documents.noDocuments')}</h3>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const Icon = CATEGORY_ICONS[d.category] ?? FileText;
            return (
              <Card key={d._id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_TONES[d.category] ?? 'bg-surface text-text-muted border-slate-200'
                    }`}
                  >
                    {t(`documents.categories.${d.category}`)}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-text-main">{d.title}</h3>
                  <p className="truncate text-xs text-text-muted">{d.fileName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                  {d.sizeBytes != null && <span>{formatBytes(d.sizeBytes)}</span>}
                  {typeof d.uploadedBy === 'object' && d.uploadedBy ? (
                    <span className="inline-flex items-center gap-1">
                      <Upload className="h-3 w-3" />
                      {d.uploadedBy?.fullName ?? ''}
                    </span>
                  ) : null}
                </div>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('documents.download')}
                </a>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        itemLabel="pagination.documents"
        disabled={loading}
        onChange={setPage}
      />
    </div>
  );
}