import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test('Admin approves a registration and sees the account', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the mutation runs once against the isolated E2E database');
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
  await expect(page.getByRole('heading', { name: 'Duyệt hồ sơ đăng ký' })).toBeVisible();
  await page.getByRole('button', { name: /Phê duyệt hồ sơ Hồ sơ E2E/i }).click();
  await expect(page.getByText('Đã duyệt hồ sơ thành công.')).toBeVisible();
  await page.getByRole('button', { name: 'Quản lý tài khoản' }).click();
  await expect(page.getByText('Hồ sơ E2E')).toBeVisible();
});

test('Admin reaches account, summary, profile and notification interactions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'mobile coverage is captured by the responsive visual suite');
  await loginAsAdmin(page);
  await expect(page.getByRole('heading', { name: 'Danh sách tài khoản' })).toBeVisible();
  await page.getByRole('button', { name: 'Lịch làm việc tổng hợp' }).click();
  await expect(page.getByRole('heading', { name: 'Lịch làm việc tổng hợp' })).toBeVisible();
  await page.getByRole('button', { name: /Mở menu tài khoản/i }).click();
  await page.getByRole('menuitem', { name: 'Thông tin tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin tài khoản' })).toBeVisible();
  await page.getByRole('button', { name: /Thông báo/ }).click();
  await expect(page.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();
});
