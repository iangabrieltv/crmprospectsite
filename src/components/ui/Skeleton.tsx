import React from 'react';
import { Loader2 } from 'lucide-react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[var(--kz-bg-muted)]/80 ${className}`}
    />
  );
};

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SPINNER_SIZES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 text-[var(--kz-text-muted)] ${className}`}>
      <Loader2 className={`animate-spin text-[var(--kz-accent)] ${SPINNER_SIZES[size]}`} />
      {label && <span className="text-xs font-medium">{label}</span>}
    </div>
  );
};
