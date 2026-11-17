import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-[11px] text-[var(--kz-text-muted)] ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && <ChevronRight className="w-3 h-3 text-[var(--kz-text-subtle)] shrink-0" />}
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-[var(--kz-text-primary)] font-medium transition-colors cursor-pointer truncate max-w-[140px]"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`truncate max-w-[160px] ${
                  isLast
                    ? 'font-semibold text-[var(--kz-text-secondary)]'
                    : 'font-medium text-[var(--kz-text-muted)]'
                }`}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
