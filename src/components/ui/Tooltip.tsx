import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  position?: 'right' | 'top' | 'bottom' | 'left';
  enabled?: boolean;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'right',
  enabled = true,
  children,
}) => {
  const [visible, setVisible] = useState(false);

  if (!enabled || !content) {
    return <>{children}</>;
  }

  const posClasses: Record<NonNullable<TooltipProps['position']>, string> = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-2.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2.5',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div
      className="relative inline-flex w-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none fixed md:absolute z-[70] px-2.5 py-1.5 rounded-lg bg-[#222229] text-[#F5F5F5] border border-[#303038] text-[11px] font-medium whitespace-nowrap shadow-[var(--kz-shadow-md)] animate-in fade-in duration-100 hidden md:block ${posClasses[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
