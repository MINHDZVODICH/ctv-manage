export type PaginationItem = number | '...';

/**
 * Generates an array of page numbers and ellipsis ('...') for 5-slot pagination controls.
 * - If total <= 5: shows all pages [1, 2, ..., total].
 * - If current <= 3: shows [1, 2, 3, '...', total].
 * - If current >= total - 2: shows [1, '...', total - 2, total - 1, total].
 * - Otherwise (middle): shows [1, '...', current, '...', total].
 */
export function getPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 1) return [1];
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // When current page <= 3: 1 2 3 ... total
  if (current <= 3) {
    return [1, 2, 3, '...', total];
  }

  // When current page is near the end: 1 ... (total - 2) (total - 1) total
  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total];
  }

  // When current page is in the middle: 1 ... current ... total
  return [1, '...', current, '...', total];
}
