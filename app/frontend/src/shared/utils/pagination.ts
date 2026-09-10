export type PaginationItem = number | '...';

/**
 * Generates an array of page numbers and ellipsis ('...') for pagination controls.
 * - If totalPages <= 7: shows all pages [1, 2, ..., totalPages].
 * - If current <= 5: shows [1, 2, 3, 4, 5, '...', totalPages].
 * - If current >= totalPages - 4: shows [1, '...', totalPages-4, ..., totalPages].
 * - Otherwise (middle): shows [1, '...', current - 1, current, current + 1, '...', totalPages].
 */
export function getPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // When current page <= 5: 1 2 3 4 5 ... total
  if (current <= 5) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  // When current page is near the end: 1 ... (total - 4) ... total
  if (current >= total - 4) {
    const endPages = [total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', ...endPages];
  }

  // When current page is in the middle: 1 ... (current - 1) current (current + 1) ... total
  return [1, '...', current - 1, current, current + 1, '...', total];
}
