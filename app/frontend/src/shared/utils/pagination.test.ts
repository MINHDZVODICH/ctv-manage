import test from 'node:test';
import assert from 'node:assert';
import { getPaginationItems } from './pagination.ts';

test('returns all pages when totalPages <= 5', () => {
  assert.deepStrictEqual(getPaginationItems(1, 4), [1, 2, 3, 4]);
  assert.deepStrictEqual(getPaginationItems(3, 5), [1, 2, 3, 4, 5]);
});

test('returns [1, 2, 3, "...", 11] when current page <= 3 of 11', () => {
  assert.deepStrictEqual(getPaginationItems(1, 11), [1, 2, 3, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(2, 11), [1, 2, 3, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(3, 11), [1, 2, 3, '...', 11]);
});

test('returns [1, "...", current, "...", 11] when in the middle of 11', () => {
  assert.deepStrictEqual(getPaginationItems(4, 11), [1, '...', 4, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(5, 11), [1, '...', 5, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(6, 11), [1, '...', 6, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(7, 11), [1, '...', 7, '...', 11]);
  assert.deepStrictEqual(getPaginationItems(8, 11), [1, '...', 8, '...', 11]);
});

test('returns [1, "...", 9, 10, 11] when current page >= 9 of 11', () => {
  assert.deepStrictEqual(getPaginationItems(9, 11), [1, '...', 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(10, 11), [1, '...', 9, 10, 11]);
  assert.deepStrictEqual(getPaginationItems(11, 11), [1, '...', 9, 10, 11]);
});

test('handles total = 6 with 5 slots cleanly', () => {
  assert.deepStrictEqual(getPaginationItems(1, 6), [1, 2, 3, '...', 6]);
  assert.deepStrictEqual(getPaginationItems(3, 6), [1, 2, 3, '...', 6]);
  assert.deepStrictEqual(getPaginationItems(4, 6), [1, '...', 4, 5, 6]);
  assert.deepStrictEqual(getPaginationItems(6, 6), [1, '...', 4, 5, 6]);
});
