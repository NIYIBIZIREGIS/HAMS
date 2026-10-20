import { HTMLAttributes, type ElementType, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export function Card({ className = '', padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-card shadow transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-card-hover ${padding ? 'p-5' : ''} ${className}`}
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
    <div className={`mb-4 flex items-start justify-between border-b border-slate-100 pb-3 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <div>
          <h3 className="text-sm font-semibold text-text-main">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
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
