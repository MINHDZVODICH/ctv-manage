import test from 'node:test';
import assert from 'node:assert';
import { getPaginationItems } from './pagination.ts';

test('returns all pages when totalPages <= 7', () => {
  assert.deepStrictEqual(getPaginationItems(1, 5), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(getPaginationItems(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('returns [1, 2, 3, 4, 5, "...", 11] when current page <= 5 of 11', () => {
  assert.deepStrictEqual(getPaginationItems(1, 11), [1, 2, 3, 4, 5, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(2, 11), [1, 2, 3, 4, 5, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(3, 11), [1, 2, 3, 4, 5, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(4, 11), [1, 2, 3, 4, 5, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(5, 11), [1, 2, 3, 4, 5, '...', 11]);
});

test('returns [1, "...", 5, 6, 7, "...", 11] when on page 6 of 11', () => {
  assert.deepStrictEqual(getPaginationItems(6, 11), [1, '...', 5, 6, 7, '...', 11]);
});

test('returns [1, "...", 7, 8, 9, 10, 11] when current page >= 7 of 11', () => {
  assert.deepStrictEqual(getPaginationItems(7, 11), [1, '...', 7, 8, 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(8, 11), [1, '...', 7, 8, 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(9, 11), [1, '...', 7, 8, 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(10, 11), [1, '...', 7, 8, 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(11, 11), [1, '...', 7, 8, 9, 10, 11]);
});

test('returns [1, "...", 7, 8, 9, "...", 20] when in middle of large page count', () => {
  assert.deepStrictEqual(getPaginationItems(8, 20), [1, '...', 7, 8, 9, '...', 20]);
});
