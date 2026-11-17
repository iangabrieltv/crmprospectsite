import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pages: number[] = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[var(--kz-border-subtle)] text-xs text-[var(--kz-text-muted)]">
      <span className="font-mono tabular-nums text-[11px]">
        Exibindo {startItem}–{endItem} de {totalItems} registros
      </span>

      <div className="flex items-center gap-1">
        <Button
          size="xs"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`h-7 min-w-[28px] px-2 rounded-md text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
              p === currentPage
                ? 'bg-[var(--kz-accent)] text-[var(--kz-accent-fg)]'
                : 'text-[var(--kz-text-secondary)] hover:bg-[var(--kz-bg-subtle)]'
            }`}
          >
            {p}
          </button>
        ))}

        <Button
          size="xs"
          variant="outline"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Próxima página"
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
