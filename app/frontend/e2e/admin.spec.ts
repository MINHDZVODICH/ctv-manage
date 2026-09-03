import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

function todayInBangkok() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function todayLabelInBangkok() {
  const ymd = todayInBangkok();
  const [year, month, day] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${dayNames[weekday]} - ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

async function getActiveCtv(page: Page) {
  const response = await page.request.get('/api/v1/accounts?page=1&pageSize=100');
  const body = await response.json();
  return body.data.find((account: any) => account.email === 'ctv.active@ctv.local');
}

test('Admin duyệt hồ sơ và thấy tài khoản mới trong danh sách', async ({ page, loginAs }) => {
  await loginAs('admin');
  await page.getByRole('button', { name: /Yêu cầu đăng ký/ }).click();
  await expect(page.getByRole('heading', { name: 'Yêu cầu đăng ký' })).toBeVisible();

  const pendingRow = page.getByRole('row').filter({ hasText: 'Hồ sơ chờ duyệt' });
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByTitle('Duyệt hồ sơ').click();
  await expect(page.getByText('Đã phê duyệt hồ sơ', { exact: true })).toBeVisible();
  await expect(pendingRow).toHaveCount(0);

  await page.getByRole('button').filter({ hasText: 'Quản lý tài khoản' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Hồ sơ chờ duyệt' })).toBeVisible();
});

test('Admin vô hiệu hóa tài khoản CTV có xác nhận', async ({ page, loginAs }) => {
  await loginAs('admin');
  const row = page.getByRole('row').filter({ hasText: 'CTV Other' });
  await expect(row).toBeVisible();
  await row.getByTitle('Vô hiệu hóa tài khoản').click();
  await expect(page.getByRole('heading', { name: 'Vô hiệu hóa tài khoản?' })).toBeVisible();
  await page.getByRole('button', { name: 'Vô hiệu hóa', exact: true }).click();
  await expect(page.getByText('Đã khóa tài khoản CTV Other', { exact: true })).toBeVisible();
  await expect(row.getByTitle('Kích hoạt tài khoản')).toBeVisible();
});

test('Modal đặt lại mật khẩu tự sinh mật khẩu ngẫu nhiên và dùng màu điểm nhấn', async ({ page, loginAs }) => {
  await loginAs('admin');
  const row = page.getByRole('row').filter({ hasText: 'CTV Active' });
  const openResetModal = () => row.getByTitle('Đặt lại mật khẩu mặc định (Quên MK)').click();

  await openResetModal();
  const passwordInput = page.getByLabel('Mật khẩu mới được tạo tự động *:');
  const firstPassword = await passwordInput.inputValue();

  expect(firstPassword).not.toBe('CTV@123456');
  expect(firstPassword).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%]).{12}$/);
  await expect(page.getByRole('button', { name: 'Xác nhận' })).toHaveClass(/bg-accent/);

  await page.getByRole('button', { name: 'Đóng' }).click();
  await openResetModal();
  await expect(page.getByLabel('Mật khẩu mới được tạo tự động *:')).not.toHaveValue(firstPassword);
});

test('Modal chi tiết CTV tách API lịch tuần và lịch sử làm việc', async ({ page, loginAs }) => {
  await loginAs('admin');
  const ctv = await getActiveCtv(page);
  const workDate = todayInBangkok();

  await page.route('**/api/v1/schedule-summary?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('accountId') !== ctv.id) {
      await route.continue();
      return;
    }

    const cells = url.searchParams.has('from')
      ? [{
          shiftId: 'shift-room-modal',
          workDate,
          period: 'MORNING',
          count: 1,
          shiftAssignments: [{
            id: 'assignment-room-modal',
            accountId: ctv.id,
            displayName: ctv.displayName,
            phone: ctv.phone,
            roomCode: 'ROOM_2',
            status: 'ACTIVE',
          }],
        }]
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { cells } }) });
  });

  const weeklyScheduleResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/schedule-summary' &&
      url.searchParams.get('accountId') !== null &&
      url.searchParams.get('from') !== null &&
      response.status() === 200
    );
  });
  await page.getByText('CTV Active', { exact: true }).click();
  await weeklyScheduleResponse;
  const detailHeading = page.getByRole('heading', { name: 'Hồ sơ & Lịch trình tài khoản' });
  await expect(detailHeading).toBeVisible();
  const detailModal = detailHeading.locator('xpath=ancestor::div[contains(@class, "max-w-3xl")][1]');
  await expect(detailModal.getByText('Chưa có', { exact: true })).toHaveCount(3);
  await expect(detailModal.locator('img[src*="images.unsplash.com"]')).toHaveCount(0);
  await expect(detailModal.getByRole('button', { name: 'Xem file' })).toHaveCount(0);
  await expect(detailModal.getByRole('button', { name: 'Tải về' })).toHaveCount(0);
  await expect(page.getByTitle('Buồng làm việc: Buồng 2')).toBeVisible();
  await expect(page.getByText('ROOM_2', { exact: true })).toHaveCount(0);

  await page.route('**/api/v1/work-history?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('accountId') === ctv.id) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  const historyResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/work-history' &&
      url.searchParams.get('accountId') !== null &&
      url.searchParams.get('month') !== null &&
      response.status() === 200
    );
  });
  await page.getByRole('button', { name: 'Lịch sử làm việc' }).click();
  await expect(page.getByRole('status')).toContainText('Đang tải...');
  await expect(page.getByText('Đang tải lịch sử làm việc từ hệ thống...', { exact: true })).toHaveCount(0);
  await historyResponse;

  await expect(page.getByRole('heading', { name: 'Lịch sử làm việc' })).toBeVisible();
  await expect(page.getByText('Không có ca làm việc đã lưu trong tháng này.')).toHaveCount(0);
});

test('Lịch tổng hợp hiển thị cùng nhãn Buồng làm việc từ roomCode', async ({ page, loginAs }) => {
  await loginAs('admin');
  const ctv = await getActiveCtv(page);
  const workDate = todayInBangkok();

  await page.route('**/api/v1/schedule-summary?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          cells: [{
            shiftId: 'shift-room-summary',
            workDate,
            period: 'MORNING',
            count: 1,
            shiftAssignments: [{
              id: 'assignment-room-summary',
              accountId: ctv.id,
              displayName: ctv.displayName,
              phone: ctv.phone,
              roomCode: 'ROOM_2',
              status: 'ACTIVE',
            }],
          }],
        },
      }),
    });
  });
  await page.route('**/api/v1/work-history?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { cells: [] } }),
    });
  });

  await page.getByRole('button').filter({ hasText: 'Lịch làm việc tổng hợp' }).click();
  await expect(page.getByRole('heading', { name: 'Lịch làm việc tổng hợp' })).toBeVisible();
  const todayHeading = page.getByRole('heading', { name: /Danh sách CTV đăng ký hôm nay/ });
  const todayCard = todayHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
  await expect(todayHeading).toContainText(todayLabelInBangkok());
  await expect(todayHeading).not.toContainText('Hôm nay (');
  await expect(todayCard.getByText(ctv.displayName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Lịch sử tổng hợp', exact: true }).click();
  await expect(todayCard.getByText(ctv.displayName, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Lịch tuần tổng hợp', exact: true }).click();
  await page.getByTitle('Bấm xem danh sách CTV ca sáng').click();

  await expect(page.getByText('Buồng làm việc', { exact: true })).toBeVisible();
  await expect(page.getByText('Buồng 2', { exact: true })).toBeVisible();
  await expect(page.getByText('ROOM_2', { exact: true })).toHaveCount(0);
});
