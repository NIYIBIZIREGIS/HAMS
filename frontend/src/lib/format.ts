export function formatMoney(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat('en-US').format(Math.round(n * 100) / 100)} RWF`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}