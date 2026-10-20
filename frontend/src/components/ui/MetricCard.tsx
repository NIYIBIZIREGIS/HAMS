import type { ElementType, ReactNode } from 'react';
import { Card } from './Card';

export function MetricCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  suffix,
  action,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  iconBg: string;
  iconColor: string;
  suffix?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <p className="font-display text-2xl font-bold text-text-main">{value}</p>
            {suffix && <span className="text-sm font-medium text-text-muted">{suffix}</span>}
          </div>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

export function HealthBar({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  const getColor = (v: number) => {
    if (v < 50) return 'bg-status-confirmed-text';
    if (v < 75) return 'bg-status-pending-text';
    return 'bg-status-cancelled-text';
  };

  const getTextColor = (v: number) => {
    if (v < 50) return 'text-status-confirmed-text';
    if (v < 75) return 'text-status-pending-text';
    return 'text-status-cancelled-text';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text-main">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${getTextColor(value)}`}>{value}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
