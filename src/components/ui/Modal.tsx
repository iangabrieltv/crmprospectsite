import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeDisabled?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon,
  headerActions,
  footer,
  size = 'md',
  closeDisabled = false,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, closeDisabled]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--kz-bg-overlay)] backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        className={`bg-[var(--kz-bg-surface)] rounded-2xl shadow-[var(--kz-shadow-lg)] ${SIZE_CLASSES[size]} w-full border border-[var(--kz-border-subtle)] overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/70 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {icon && <div className="shrink-0">{icon}</div>}
              <div className="min-w-0">
                {title && (
                  <h3 className="text-sm font-bold text-[var(--kz-text-primary)] leading-tight truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <div className="text-[11px] text-[var(--kz-text-muted)] mt-0.5 truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              <button
                type="button"
                disabled={closeDisabled}
                onClick={onClose}
                className="p-1.5 text-[var(--kz-text-subtle)] hover:text-[var(--kz-text-primary)] hover:bg-[var(--kz-bg-subtle)] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Fechar janela"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

        {footer && (
          <div className="px-4 sm:px-5 py-3 border-t border-[var(--kz-border-subtle)] bg-[var(--kz-bg-canvas)]/60 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  confirmDisabled = false,
  children,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeDisabled={loading}
      title={title}
      icon={
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center ${
            variant === 'danger'
              ? 'bg-[var(--kz-danger-bg)] text-[var(--kz-danger-text)]'
              : 'bg-[var(--kz-accent-soft)] text-[var(--kz-accent-text)]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs text-[var(--kz-text-secondary)] leading-relaxed">
        <div>{description}</div>
        {children}
      </div>
    </Modal>
  );
};
