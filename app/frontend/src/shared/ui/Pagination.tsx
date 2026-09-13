import React from 'react';
import type { PaginationItem } from '../utils/pagination';
import { getPaginationItems } from '../utils/pagination';
import { useSystemSettings } from '../context/SystemSettingsContext';

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
  const { t } = useSystemSettings();

  if (totalPages <= 1) {
    return null;
  }

  const items = getPaginationItems(page, totalPages);

  return (
    <nav
      aria-label={t('pagination.page_navigation')}
      className={`flex items-center gap-1.5 ${className}`}
    >
      {/* Previous Page Button */}
      <button
        type="button"
        disabled={page === 1 || loading}
        onClick={() => onPageChange(Math.max(page - 1, 1))}
        className="w-9 h-9 flex items-center justify-center rounded border border-[#E2E8F0] dark:border-[#3b3d45] text-[#44474e] dark:text-[#c4c6cf] hover:bg-[#f4f3f7] dark:hover:bg-[#2c2d33] hover:text-[#1b365d] dark:hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#44474e] cursor-pointer"
        title={t('pagination.aria_prev')}
        aria-label={t('pagination.aria_prev')}
      >
        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
      </button>

      {/* Page Numbers and Ellipsis */}
      {items.map((item: PaginationItem, idx: number) => {
        if (item === '...') {
          return (
            <span
              key={`dots-${idx}`}
              className="min-w-[36px] h-9 flex items-center justify-center text-sm font-semibold text-[#74777f] dark:text-[#9ca3af] select-none"
              aria-hidden="true"
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
            aria-label={t('pagination.aria_page', { page: pageNum })}
            aria-current={isActive ? 'page' : undefined}
            className={`min-w-[36px] h-9 px-2 flex items-center justify-center rounded text-sm font-semibold transition-colors cursor-pointer ${
              isActive
                ? 'bg-accent text-white shadow-xs'
                : 'border border-[#E2E8F0] dark:border-[#3b3d45] text-[#44474e] dark:text-[#c4c6cf] hover:bg-[#f4f3f7] dark:hover:bg-[#2c2d33] hover:text-[#1b365d] dark:hover:text-white'
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
        className="w-9 h-9 flex items-center justify-center rounded border border-[#E2E8F0] dark:border-[#3b3d45] text-[#44474e] dark:text-[#c4c6cf] hover:bg-[#f4f3f7] dark:hover:bg-[#2c2d33] hover:text-[#1b365d] dark:hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#44474e] cursor-pointer"
        title={t('pagination.aria_next')}
        aria-label={t('pagination.aria_next')}
      >
        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
      </button>
    </nav>
  );
};
