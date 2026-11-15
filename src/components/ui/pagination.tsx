import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  className?: string;
  showInfo?: boolean;
}

type PageSlot = number | 'gap-start' | 'gap-end';

function visiblePages(currentPage: number, totalPages: number): PageSlot[] {
  const delta = 1;
  const start = Math.max(2, currentPage - delta);
  const end = Math.min(totalPages - 1, currentPage + delta);
  const slots: PageSlot[] = [1];
  if (start > 2) slots.push('gap-start');
  for (let i = start; i <= end; i += 1) slots.push(i);
  if (end < totalPages - 1) slots.push('gap-end');
  if (totalPages > 1) slots.push(totalPages);
  return slots;
}

const cell =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-mono text-[13px] transition-colors';

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  className,
  showInfo = true,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      {showInfo && (
        <p className="text-[13px] text-ink-2">
          <span className="font-mono text-ink">
            {startItem.toLocaleString('en-US')}–
            {endItem.toLocaleString('en-US')}
          </span>{' '}
          of{' '}
          <span className="font-mono text-ink">
            {totalItems.toLocaleString('en-US')}
          </span>
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          disabled={currentPage === 1}
          className={cn(
            cell,
            'border border-rule hover:border-ink disabled:opacity-40 disabled:hover:border-rule'
          )}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>

        {visiblePages(currentPage, totalPages).map((slot) => {
          if (typeof slot !== 'number') {
            return (
              <span
                key={slot}
                className={cn(cell, 'hidden text-ink-2 sm:inline-flex')}
                aria-hidden="true"
              >
                …
              </span>
            );
          }
          const isCurrent = slot === currentPage;
          return (
            <button
              type="button"
              key={slot}
              onClick={() => onPageChange(slot)}
              aria-label={`Page ${slot}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                cell,
                isCurrent
                  ? 'pointer-events-none bg-ink text-on-ink'
                  : 'hidden text-ink hover:bg-sage-tint sm:inline-flex'
              )}
            >
              {slot}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          disabled={currentPage === totalPages}
          className={cn(
            cell,
            'border border-rule hover:border-ink disabled:opacity-40 disabled:hover:border-rule'
          )}
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}

// Hook for pagination logic
export function usePagination(totalItems: number, itemsPerPage: number = 50) {
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Reset to page 1 when total items change significantly. Adjusting state
  // during render (instead of in an effect) avoids an extra render pass.
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return {
    currentPage,
    totalPages,
    setCurrentPage,
    startIndex,
    endIndex,
    itemsPerPage,
  };
}
