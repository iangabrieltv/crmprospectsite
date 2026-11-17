import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps {
  trigger: (isOpen: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  menuClassName?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'left',
  menuClassName = 'w-64',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)}>{trigger(isOpen)}</div>
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${menuClassName} max-w-[calc(100vw-24px)] bg-[var(--kz-bg-subtle)] rounded-xl shadow-[var(--kz-shadow-lg)] border border-[var(--kz-border-default)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          {children(() => setIsOpen(false))}
        </div>
      )}
    </div>
  );
};
