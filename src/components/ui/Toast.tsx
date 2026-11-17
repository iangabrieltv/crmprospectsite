import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'success',
  onDismiss,
}) => {
  const styleMap = {
    success:
      'bg-[var(--kz-bg-subtle)] border-[var(--kz-success-border)] text-[var(--kz-text-primary)]',
    warning:
      'bg-[var(--kz-bg-subtle)] border-[var(--kz-warning-border)] text-[var(--kz-text-primary)]',
    danger:
      'bg-[var(--kz-bg-subtle)] border-[var(--kz-danger-border)] text-[var(--kz-text-primary)]',
    info:
      'bg-[var(--kz-bg-subtle)] border-[var(--kz-info-border)] text-[var(--kz-text-primary)]',
  };

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-[var(--kz-success-solid)] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[var(--kz-warning-solid)] shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-[var(--kz-danger-solid)] shrink-0" />,
    info: <Info className="w-4 h-4 text-[var(--kz-info-solid)] shrink-0" />,
  };

  return (
    <div
      role="status"
      className={`fixed bottom-16 md:bottom-5 right-4 z-[60] max-w-sm border rounded-xl px-3.5 py-2.5 shadow-[var(--kz-shadow-md)] flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150 ${styleMap[variant]}`}
    >
      {iconMap[variant]}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] cursor-pointer"
          aria-label="Dispensar notificação"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
