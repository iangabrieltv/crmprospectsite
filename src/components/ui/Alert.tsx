import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const STYLES: Record<
  AlertVariant,
  { container: string; icon: React.ReactNode }
> = {
  info: {
    container:
      'bg-[var(--kz-info-bg)] border-[var(--kz-info-border)] text-[var(--kz-info-text)]',
    icon: <Info className="w-4 h-4 shrink-0 mt-0.5" />,
  },
  success: {
    container:
      'bg-[var(--kz-success-bg)] border-[var(--kz-success-border)] text-[var(--kz-success-text)]',
    icon: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />,
  },
  warning: {
    container:
      'bg-[var(--kz-warning-bg)] border-[var(--kz-warning-border)] text-[var(--kz-warning-text)]',
    icon: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />,
  },
  danger: {
    container:
      'bg-[var(--kz-danger-bg)] border-[var(--kz-danger-border)] text-[var(--kz-danger-text)]',
    icon: <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />,
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
}) => {
  const style = STYLES[variant];
  return (
    <div
      role="alert"
      className={`border rounded-xl p-3.5 text-xs flex items-start gap-2.5 ${style.container} ${className}`}
    >
      {style.icon}
      <div className="flex-1 min-w-0 space-y-0.5">
        {title && <div className="font-bold">{title}</div>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Fechar alerta"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
