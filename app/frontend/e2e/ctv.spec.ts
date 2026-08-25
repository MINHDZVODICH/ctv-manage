import { expect, test } from '@playwright/test';
import { loginAsCtv } from './helpers';

test('CTV saves a weekly schedule and cancels one assignment', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the mutation runs once against the isolated E2E database');
  await loginAsCtv(page);
  await page.getByRole('button', { name: 'Đăng ký lịch làm việc' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký lịch làm việc' });
  await dialog.getByLabel('Buồng làm việc').selectOption('ROOM_1');
  await dialog.getByLabel('Nội dung công việc').fill('Hỗ trợ xử lý dữ liệu');
  const mondayMorning = dialog.getByRole('button', { name: 'Thứ 2 Ca sáng' });
  if (await mondayMorning.getAttribute('aria-pressed') === 'true') await mondayMorning.click();
  await mondayMorning.click();
  await expect(mondayMorning).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Lưu lịch' }).click();
  await expect(page.getByText('Đã lưu lịch làm việc và cập nhật lịch cá nhân.')).toBeVisible();
  await page.getByRole('button', { name: 'Xem tuần sau' }).click();
  await page.getByRole('button', { name: /Ca sáng,/i }).click();
  await page.getByRole('button', { name: 'Chỉ hủy ca này' }).click();
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.getByText('Đã hủy 1 ca làm việc.')).toBeVisible();
});

test('CTV uses the responsive navigation drawer and profile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'responsive navigation coverage');
  await loginAsCtv(page);
  await page.getByRole('button', { name: 'Mở danh mục' }).click();
  await expect(page.getByRole('dialog', { name: 'Danh mục điều hướng' })).toBeVisible();
  await page.getByRole('button', { name: 'Thông tin tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin tài khoản' })).toBeVisible();
});
