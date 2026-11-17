import React from 'react';

interface BaseFieldProps {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    BaseFieldProps {
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      required,
      leftIcon,
      rightElement,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `kz-input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block kz-label"
          >
            {label}
            {required && <span className="text-[var(--kz-danger-solid)] ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--kz-text-subtle)] pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full h-9 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-[var(--kz-bg-muted)] disabled:text-[var(--kz-text-muted)] disabled:cursor-not-allowed ${
              leftIcon ? 'pl-8' : 'px-3'
            } ${rightElement ? 'pr-9' : 'pr-3'} ${
              error
                ? 'border-[var(--kz-danger-solid)] focus:ring-rose-500/30'
                : 'border-[var(--kz-border-default)] hover:border-[var(--kz-border-strong)] focus:ring-[var(--kz-accent)]/30 focus:border-[var(--kz-accent)]'
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
              {rightElement}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-[11px] font-medium text-[var(--kz-danger-text)]">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[var(--kz-text-muted)]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    BaseFieldProps {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, required, className = '', id, children, ...props }, ref) => {
    const selectId = id || (label ? `kz-select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block kz-label">
            {label}
            {required && <span className="text-[var(--kz-danger-solid)] ml-0.5">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          className={`w-full h-9 px-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] border rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 disabled:bg-[var(--kz-bg-muted)] disabled:text-[var(--kz-text-muted)] disabled:cursor-not-allowed ${
            error
              ? 'border-[var(--kz-danger-solid)] focus:ring-rose-500/30'
              : 'border-[var(--kz-border-default)] hover:border-[var(--kz-border-strong)] focus:ring-[var(--kz-accent)]/30 focus:border-[var(--kz-accent)]'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p className="text-[11px] font-medium text-[var(--kz-danger-text)]">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[var(--kz-text-muted)]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    BaseFieldProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, required, className = '', id, ...props }, ref) => {
    const areaId = id || (label ? `kz-textarea-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={areaId} className="block kz-label">
            {label}
            {required && <span className="text-[var(--kz-danger-solid)] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          required={required}
          className={`w-full p-2.5 text-xs bg-[var(--kz-bg-subtle)] text-[var(--kz-text-primary)] placeholder:text-[var(--kz-text-subtle)] border rounded-lg transition-colors focus:outline-none focus:ring-2 disabled:bg-[var(--kz-bg-muted)] disabled:text-[var(--kz-text-muted)] disabled:cursor-not-allowed ${
            error
              ? 'border-[var(--kz-danger-solid)] focus:ring-rose-500/30'
              : 'border-[var(--kz-border-default)] hover:border-[var(--kz-border-strong)] focus:ring-[var(--kz-accent)]/30 focus:border-[var(--kz-accent)]'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[11px] font-medium text-[var(--kz-danger-text)]">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[var(--kz-text-muted)]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
