import { HTMLAttributes, type ElementType, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ className = '', padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-card shadow transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-card-hover ${padding ? 'p-4 sm:p-5' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ElementType;
  className?: string;
}

export function CardHeader({ title, subtitle, action, icon: Icon, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 sm:mb-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" />}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text-main">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export function CardBody({ className = '', noPadding = false, children, ...props }: CardBodyProps) {
  return (
    <div className={noPadding ? className : `${className}`} {...props}>
      {children}
    </div>
  );
}
