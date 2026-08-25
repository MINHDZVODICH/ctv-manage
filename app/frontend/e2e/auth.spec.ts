import { expect, test } from '@playwright/test';
import { freezeToE2eDate, loginAsAdmin } from './helpers';

test('authenticates a server-provided Admin session without a demo role switch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop navigation is hidden behind the responsive drawer');
  await loginAsAdmin(page);
  await expect(page.getByRole('button', { name: 'Quản lý tài khoản' })).toBeVisible();
  await expect(page.getByText(/chuyển vai trò/i)).toHaveCount(0);
});

test('shows the production login screen at the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout coverage');
  await freezeToE2eDate(page); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng ký Cộng tác viên/i })).toBeVisible();
});
