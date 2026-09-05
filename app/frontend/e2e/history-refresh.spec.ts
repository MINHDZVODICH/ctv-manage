import { test, expect } from './fixtures';

test('CTV Work History renders today shift from database without clock gating and refetches on focus and visibilitychange', async ({
  page,
  loginAs,
}) => {
  // Fix time to 09:00 AM Bangkok (02:00 UTC) - way before 17:30 cutoff
  await page.clock.setFixedTime(new Date('2026-09-02T02:00:00.000Z'));

  const todayStr = '2026-09-02';
  let fetchCount = 0;

  await page.route('**/api/v1/users/me/work-history?*', async (route) => {
    fetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          month: '2026-09',
          entries: [
            {
              id: 'history-today-morning',
              workDate: todayStr,
              period: 'MORNING',
              roomCode: 'ROOM_1',
            },
          ],
        },
      }),
    });
  });

  await loginAs('ctv');
  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();

  // Today's shift badge must be rendered even though clock is 09:00 AM (before 17:30)
  const morningBadge = page.getByLabel(/Ca Sáng,/);
  await expect(morningBadge).toHaveCount(1);
  await expect(morningBadge).toBeVisible();

  const initialCount = fetchCount;
  expect(initialCount).toBeGreaterThanOrEqual(1);

  // Trigger window focus -> should refetch history
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => fetchCount).toBeGreaterThan(initialCount);

  const afterFocusCount = fetchCount;

  // Trigger visibility change to visible -> should refetch history
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => fetchCount).toBeGreaterThan(afterFocusCount);
});

test('Summary Work History renders today shift without calling isAfterCutoffTime and refetches on focus and visibilitychange', async ({
  page,
  loginAs,
}) => {
  // Fix time to 10:00 AM Bangkok (03:00 UTC) - way before 17:30 cutoff
  await page.clock.setFixedTime(new Date('2026-09-02T03:00:00.000Z'));

  const todayStr = '2026-09-02';
  let summaryFetchCount = 0;

  await page.route('**/api/v1/work-history?month=2026-09', async (route) => {
    summaryFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          month: '2026-09',
          cells: [
            {
              shiftId: 'hist-summary-today',
              workDate: todayStr,
              period: 'MORNING',
              count: 1,
              shiftAssignments: [
                {
                  id: 'assign-1',
                  accountId: 'ctv-1',
                  displayName: 'CTV Active',
                  phone: '0900000001',
                  roomCode: 'ROOM_1',
                  status: 'COMPLETED',
                },
              ],
            },
          ],
        },
      }),
    });
  });

  await loginAs('admin');
  await page.getByRole('button', { name: 'Lịch làm việc tổng hợp' }).click();
  await page.getByRole('button', { name: 'Lịch sử tổng hợp' }).click();

  // Button showing 1 CTV on today's shift must be rendered despite clock at 10:00 AM
  const ctvBadge = page.getByTitle('Bấm xem danh sách CTV ca sáng');
  await expect(ctvBadge).toBeVisible();
  await expect(ctvBadge.getByText('1 CTV')).toBeVisible();

  const countBefore = summaryFetchCount;

  // Trigger window focus
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => summaryFetchCount).toBeGreaterThan(countBefore);

  const countAfterFocus = summaryFetchCount;

  // Trigger visibility change to visible
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => summaryFetchCount).toBeGreaterThan(countAfterFocus);
});
