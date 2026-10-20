import { User } from 'lucide-react';

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

interface Props {
  name?: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function getInitials(name?: string): string {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserAvatar({ name, imageUrl, size = 'md', className = '' }: Props) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ? `${name}'s avatar` : 'Profile avatar'}
        className={`shrink-0 rounded-full object-cover ${sizeClasses[size]} ${className}`}
        loading="lazy"
      />
    );
  }

  const initials = getInitials(name);

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    >
      {initials ? (
        initials
      ) : (
        <User className="h-1/2 w-1/2" />
      )}
    </span>
  );
}