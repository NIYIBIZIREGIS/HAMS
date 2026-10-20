import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';

interface AuditLogEntry {
  _id: string;
  timestamp: string;
  user: { _id: string; fullName: string; email: string } | string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'READ';
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
}

interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-primary-50 text-primary-700 border-primary-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
  LOGIN: 'bg-slate-200 text-slate-800 border-slate-300',
  LOGOUT: 'bg-slate-100 text-slate-600 border-slate-200',
  READ: 'bg-slate-50 text-slate-500 border-slate-200',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'Facility', label: 'Facility' },
  { value: 'User', label: 'User' },
  { value: 'Appointment', label: 'Appointment' },
  { value: 'Specialization', label: 'Specialization' },
  { value: 'Settings', label: 'Settings' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditLogsPage() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, startDate, endDate, actionFilter, resourceFilter, userSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      if (userSearch) params.userId = userSearch;
      const res = await api.get('/admin/audit-logs', { params });
      return res.data as AuditLogsResponse;
    },
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-display">Audit Logs</h1>
        <p className="text-sm text-slate-500">Track all system activities and user actions</p>
      </div>

      <Card>
        <CardHeader title="Filters" subtitle="Refine log entries" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="From Date"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
          <Input
            label="To Date"
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />
          <Input
            label="User ID or Email"
            placeholder="Search by user..."
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
          />
          <Select
            label="Action Type"
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          />
          <Select
            label="Resource Type"
            options={RESOURCE_OPTIONS}
            value={resourceFilter}
            onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          />
        </div>
      </Card>

      <Card padding={false}>
        <CardHeader
          title="Log Entries"
          subtitle={pagination ? `${pagination.total} total entries` : undefined}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No audit log entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isExpanded = expandedRow === log._id;
                  const userName = typeof log.user === 'object' ? log.user.fullName : log.user;
                  const userEmail = typeof log.user === 'object' ? log.user.email : '';
                  return (
                    <Fragment key={log._id}>
                      <tr className="transition-colors hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{userName || 'System'}</p>
                            {userEmail && <p className="text-xs text-slate-500">{userEmail}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                              ACTION_STYLES[log.action] || 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{log.resource}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {log.resourceId ? `ID: ${log.resourceId}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {log.ipAddress}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : log._id)}
                            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-4 py-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase text-slate-500">Full Details</p>
                                <pre className="mt-1 rounded-lg bg-white border border-slate-200 p-3 text-xs text-slate-700 overflow-x-auto">
                                  {log.details ? JSON.stringify(log.details, null, 2) : 'No additional details'}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium uppercase text-slate-500">User Agent</p>
                                  <p className="mt-1 text-xs text-slate-600 break-all">{log.userAgent || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium uppercase text-slate-500">Resource ID</p>
                                  <p className="mt-1 font-mono text-xs text-slate-600">{log.resourceId || '—'}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPage(pagination.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
