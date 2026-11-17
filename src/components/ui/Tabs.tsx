import React from 'react';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps<T extends string = string> {
  items: TabOption<T>[];
  activeId: T;
  onChange: (id: T) => void;
  variant?: 'segmented' | 'underline';
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  activeId,
  onChange,
  variant = 'segmented',
  className = '',
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div
        className={`flex items-center gap-1 border-b border-[var(--kz-border-subtle)] overflow-x-auto no-scrollbar ${className}`}
        role="tablist"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-[var(--kz-accent)] text-[var(--kz-accent-text)]'
                  : 'border-transparent text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)] hover:border-[var(--kz-border-default)]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    isActive
                      ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
                      : 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-muted)]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center bg-[var(--kz-bg-canvas)] p-1 rounded-xl border border-[var(--kz-border-subtle)] overflow-x-auto no-scrollbar max-w-full ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border border-[var(--kz-border-default)] shadow-[var(--kz-shadow-xs)]'
                : 'border border-transparent text-[var(--kz-text-muted)] hover:text-[var(--kz-text-primary)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                  isActive
                    ? 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
                    : 'bg-[var(--kz-bg-muted)] text-[var(--kz-text-secondary)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
