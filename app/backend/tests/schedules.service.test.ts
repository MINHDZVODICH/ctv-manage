import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { expandPattern } from '../src/modules/schedules/schedule.service.js';

describe('expandPattern', () => {
  test('expands only selected weekdays and periods in Asia/Bangkok', () => {
    assert.deepEqual(expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-08-28',
      timeZone: 'Asia/Bangkok',
      slots: [{ weekday: 1, period: 'MORNING' }],
    }), [{ workDate: '2026-08-24', period: 'MORNING' }]);
  });

  test('orders occurrences by date then period without depending on the host timezone', () => {
    assert.deepEqual(expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-09-01',
      timeZone: 'Asia/Bangkok',
      slots: [
        { weekday: 2, period: 'MORNING' },
        { weekday: 1, period: 'AFTERNOON' },
        { weekday: 1, period: 'MORNING' },
      ],
    }), [
      { workDate: '2026-08-24', period: 'MORNING' },
      { workDate: '2026-08-24', period: 'AFTERNOON' },
      { workDate: '2026-08-25', period: 'MORNING' },
      { workDate: '2026-08-31', period: 'MORNING' },
      { workDate: '2026-08-31', period: 'AFTERNOON' },
      { workDate: '2026-09-01', period: 'MORNING' },
    ]);
  });

  test('rejects weekend pattern slots', () => {
    assert.throws(() => expandPattern({
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      timeZone: 'Asia/Bangkok',
      slots: [{ weekday: 6, period: 'MORNING' }],
    }), /weekday/i);
  });
});
