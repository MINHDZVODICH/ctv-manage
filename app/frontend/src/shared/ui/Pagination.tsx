import React from 'react';
import { getPaginationItems, PaginationItem } from '../utils/pagination';

export interface PaginationProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  loading = false,
  onPageChange,
  className = '',
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const items = getPaginationItems(page, totalPages);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Previous Page Button */}
      <button
        type="button"
        disabled={page === 1 || loading}
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        className="w-9 h-9 flex items-center justify-center rounded border border-[#E2E8F0] text-[#44474e] hover:bg-[#f4f3f7] hover:text-[#1b365d] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#44474e] cursor-pointer"
        title="Trang trước"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
      </button>

      {/* Page Numbers and Ellipsis */}
      {items.map((item: PaginationItem, idx: number) => {
        if (item === '...') {
          return (
            <span
              key={`dots-${idx}`}
              className="min-w-[36px] h-9 flex items-center justify-center text-sm font-semibold text-[#74777f] select-none"
            >
              ...
            </span>
          );
        }

        const pageNum = item;
        const isActive = page === pageNum;

        return (
          <button
            key={pageNum}
            type="button"
            disabled={loading}
            onClick={() => onPageChange(pageNum)}
            className={`min-w-[36px] h-9 px-2 flex items-center justify-center rounded text-sm font-semibold transition-colors cursor-pointer ${
              isActive
                ? 'bg-accent text-white shadow-xs'
                : 'border border-[#E2E8F0] text-[#44474e] hover:bg-[#f4f3f7] hover:text-[#1b365d]'
            }`}
          >
            {pageNum}
          </button>
        );
      })}

      {/* Next Page Button */}
      <button
        type="button"
        disabled={page === totalPages || loading}
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
        className="w-9 h-9 flex items-center justify-center rounded border border-[#E2E8F0] text-[#44474e] hover:bg-[#f4f3f7] hover:text-[#1b365d] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#44474e] cursor-pointer"
        title="Trang sau"
      >
        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
      </button>
    </div>
  );
};
