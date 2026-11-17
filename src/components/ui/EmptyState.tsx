import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-10 bg-[var(--kz-bg-surface)] border border-dashed border-[var(--kz-border-default)] rounded-xl ${className}`}
    >
      {icon && (
        <div className="w-11 h-11 rounded-xl bg-[var(--kz-bg-subtle)] border border-[var(--kz-border-subtle)] flex items-center justify-center text-[var(--kz-text-muted)] mb-3">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-bold text-[var(--kz-text-primary)]">{title}</h4>
      {description && (
        <p className="text-xs text-[var(--kz-text-muted)] max-w-md mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex items-center gap-2">{action}</div>}
    </div>
  );
};
