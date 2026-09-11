import { test, expect } from './fixtures';
import {
  CANONICAL_WORK_DATE_TODAY,
  CANONICAL_WORK_DATE_PREV,
  canonicalCtvHistoryPayload,
  canonicalSummaryHistoryPayload,
} from './history-fixtures';

// ---------------------------------------------------------------------------
// 1. CTV WORK HISTORY VIEW
// ---------------------------------------------------------------------------

test('CTV Work History renders today shift from database without clock gating and refetches on focus and visibilitychange', async ({
  page,
  loginAs,
}) => {
  // Fix time to 09:00 AM Bangkok (02:00 UTC) - before 17:30 cutoff
  await page.clock.setFixedTime(new Date('2026-09-02T02:00:00.000Z'));

  let fetchCount = 0;
  await page.route('**/api/v1/users/me/work-history?*', async (route) => {
    fetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalCtvHistoryPayload),
    });
  });

  await loginAs('ctv');
  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();

  // Today's shift badge must be rendered even though clock is 09:00 AM (before 17:30)
  const morningBadge = page.getByLabel(/Ca Sáng,/);
  await expect(morningBadge.first()).toBeVisible();

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

test('CTV Work History refetches on month change and handles error retry', async ({
  page,
  loginAs,
}) => {
  const requestedMonths: string[] = [];
  let shouldFail = false;

  await page.route('**/api/v1/users/me/work-history?*', async (route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') ?? '';
    requestedMonths.push(month);

    if (shouldFail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load' } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalCtvHistoryPayload),
    });
  });

  await loginAs('ctv');
  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();

  expect(requestedMonths.length).toBeGreaterThanOrEqual(1);

  // Navigate to next month
  const countBeforeNext = requestedMonths.length;
  await page.getByRole('button', { name: 'Xem tháng sau' }).click();
  await expect.poll(() => requestedMonths.length).toBeGreaterThan(countBeforeNext);
  expect(requestedMonths[requestedMonths.length - 1]).toContain('-10');

  // Trigger error state and verify retry button
  shouldFail = true;
  await page.getByRole('button', { name: 'Xem tháng trước' }).click();

  // Retry button appears
  const retryBtn = page.getByRole('button', { name: /Thử lại|Retry/i });
  await expect(retryBtn).toBeVisible();

  // Clicking retry succeeds when shouldFail = false
  shouldFail = false;
  await retryBtn.click();
  await expect(retryBtn).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 2. SUMMARY WORK HISTORY VIEW
// ---------------------------------------------------------------------------

test('Summary Work History renders today shift without calling isAfterCutoffTime and refetches on focus and visibilitychange', async ({
  page,
  loginAs,
}) => {
  // Fix time to 10:00 AM Bangkok (03:00 UTC) - before 17:30 cutoff
  await page.clock.setFixedTime(new Date('2026-09-02T03:00:00.000Z'));

  let summaryFetchCount = 0;
  await page.route('**/api/v1/work-history?*', async (route) => {
    summaryFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalSummaryHistoryPayload),
    });
  });

  await loginAs('admin');
  await page.getByRole('button', { name: 'Lịch làm việc tổng hợp' }).click();
  await page.getByRole('button', { name: 'Lịch sử tổng hợp' }).click();

  // Button showing 1 CTV on today's shift must be rendered despite clock at 10:00 AM
  const ctvBadge = page.getByTitle('Bấm xem danh sách CTV ca sáng');
  await expect(ctvBadge.first()).toBeVisible();

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

test('Summary Work History refetches on month change and handles error retry', async ({
  page,
  loginAs,
}) => {
  const requestedMonths: string[] = [];
  let shouldFail = false;

  await page.route('**/api/v1/work-history?*', async (route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') ?? '';
    requestedMonths.push(month);

    if (shouldFail) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load' } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalSummaryHistoryPayload),
    });
  });

  await loginAs('admin');
  await page.getByRole('button', { name: 'Lịch làm việc tổng hợp' }).click();
  await page.getByRole('button', { name: 'Lịch sử tổng hợp' }).click();

  expect(requestedMonths.length).toBeGreaterThanOrEqual(1);

  // Navigate to next month
  const countBeforeNext = requestedMonths.length;
  await page.getByRole('button', { name: 'Xem tháng sau' }).click();
  await expect.poll(() => requestedMonths.length).toBeGreaterThan(countBeforeNext);
  expect(requestedMonths[requestedMonths.length - 1]).toContain('-10');

  // Trigger error state and verify retry button
  shouldFail = true;
  await page.getByRole('button', { name: 'Xem tháng trước' }).click();

  const retryBtn = page.getByRole('button', { name: /Thử lại|Retry/i });
  await expect(retryBtn).toBeVisible();

  shouldFail = false;
  await retryBtn.click();
  await expect(retryBtn).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// 3. ACCOUNT WORK HISTORY VIEW (Admin ViewAccountDetailModal)
// ---------------------------------------------------------------------------

test('Account Work History renders today shift without clock gating and refetches on focus and visibilitychange', async ({
  page,
  loginAs,
}) => {
  // Fix time to 10:00 AM Bangkok (03:00 UTC) - before 17:30 cutoff
  await page.clock.setFixedTime(new Date('2026-09-02T03:00:00.000Z'));

  let accountFetchCount = 0;
  await page.route('**/api/v1/work-history?*accountId=*', async (route) => {
    accountFetchCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(canonicalSummaryHistoryPayload),
    });
  });

  await loginAs('admin');

  // Open first CTV account detail modal by clicking the account name/avatar in the table
  const viewDetailTriggers = page.getByTitle(/Xem hồ sơ chi tiết của/i);
  await viewDetailTriggers.first().click();

  // Open Work History
  await page.getByRole('button', { name: 'Lịch sử làm việc' }).click();
  await expect(page.getByRole('heading', { name: 'Lịch sử làm việc' })).toBeVisible();

  // Today's shift badge must be rendered despite clock at 10:00 AM
  const morningBadge = page.getByText(/Ca Sáng/i).first();
  await expect(morningBadge).toBeVisible();

  const countBefore = accountFetchCount;
  expect(countBefore).toBeGreaterThanOrEqual(1);

  // Trigger window focus -> should refetch history
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => accountFetchCount).toBeGreaterThan(countBefore);

  const countAfterFocus = accountFetchCount;

  // Trigger visibility change to visible -> should refetch history
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => accountFetchCount).toBeGreaterThan(countAfterFocus);
});

test('Account Work History refetches on month change and switches accounts without stale data', async ({
  page,
  loginAs,
}) => {
  const requestedCalls: Array<{ month: string; accountId: string }> = [];

  await page.route('**/api/v1/work-history?*accountId=*', async (route) => {
    const url = new URL(route.request().url());
    const month = url.searchParams.get('month') ?? '';
    const accountId = url.searchParams.get('accountId') ?? '';
    requestedCalls.push({ month, accountId });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          month,
          cells: [
            {
              shiftId: `cell-${accountId}`,
              workDate: '2026-09-02',
              period: 'MORNING',
              count: 1,
              shiftAssignments: [
                {
                  id: `assign-${accountId}`,
                  accountId,
                  displayName: `CTV ${accountId}`,
                  phone: '0900000000',
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

  // Open first CTV account detail modal
  const viewDetailTriggers = page.getByTitle(/Xem hồ sơ chi tiết của/i);
  await viewDetailTriggers.first().click();

  // Open Work History
  await page.getByRole('button', { name: 'Lịch sử làm việc' }).click();
  await expect(page.getByRole('heading', { name: 'Lịch sử làm việc' })).toBeVisible();

  const firstCallCount = requestedCalls.length;
  expect(firstCallCount).toBeGreaterThanOrEqual(1);
  const firstAccountId = requestedCalls[0].accountId;

  // Change month: click 'Xem tháng sau'
  await page.getByRole('button', { name: 'Xem tháng sau' }).click();
  await expect.poll(() => requestedCalls.length).toBeGreaterThan(firstCallCount);
  expect(requestedCalls[requestedCalls.length - 1].month).toContain('-10');
  expect(requestedCalls[requestedCalls.length - 1].accountId).toBe(firstAccountId);

  // Close work history modal
  await page.getByRole('button', { name: 'Đóng lịch sử' }).click();
  // Close account detail modal
  await page.getByRole('button', { name: 'Đóng hồ sơ' }).click();

  // If there is another CTV account, open it
  if ((await viewDetailTriggers.count()) > 1) {
    await viewDetailTriggers.nth(1).click();
    await page.getByRole('button', { name: 'Lịch sử làm việc' }).click();
    await expect(page.getByRole('heading', { name: 'Lịch sử làm việc' })).toBeVisible();

    const lastCall = requestedCalls[requestedCalls.length - 1];
    expect(lastCall.accountId).not.toBe(firstAccountId);
  }
});
