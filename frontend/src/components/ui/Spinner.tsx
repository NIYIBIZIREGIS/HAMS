import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  return (
    <Loader2 className={`animate-spin text-primary ${sizeMap[size]} ${className}`} aria-label={label || 'Loading'} />
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  );
}
