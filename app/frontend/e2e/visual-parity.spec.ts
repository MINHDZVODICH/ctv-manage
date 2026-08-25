import { expect, test } from '@playwright/test';
import { loginAsAdmin, loginAsCtv } from './helpers';

test('login remains visually stable', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot(`login-${test.info().project.name}.png`, { fullPage: true, animations: 'disabled' });
});

test('Admin reference screens remain visually stable', async ({ page }, testInfo) => {
  await loginAsAdmin(page);
  await expect(page.locator('.account-table-wrap, .empty-state').first()).toBeVisible();
  await expect(page).toHaveScreenshot(`admin-accounts-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
  await navigate(page, testInfo.project.name, 'Duyệt hồ sơ');
  await expect(page.locator('.request-table-wrap, .empty-state').first()).toBeVisible();
  await expect(page).toHaveScreenshot(`admin-requests-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
  await navigate(page, testInfo.project.name, 'Lịch làm việc tổng hợp');
  await expect(page.locator('.summary-calendar').first()).toBeVisible();
  await expect(page).toHaveScreenshot(`admin-summary-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
  if (testInfo.project.name === 'mobile') await navigate(page, testInfo.project.name, 'Thông tin tài khoản');
  else { await page.getByRole('button', { name: /Mở menu tài khoản/i }).click(); await page.getByRole('menuitem', { name: 'Thông tin tài khoản' }).click(); }
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
  await expect(page).toHaveScreenshot(`admin-profile-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
});

async function navigate(page: import('@playwright/test').Page, project: string, label: string) {
  if (project === 'mobile') await page.getByRole('button', { name: 'Mở danh mục' }).click();
  await page.getByRole('button', { name: label }).click();
}

test('CTV reference screens remain visually stable', async ({ page }, testInfo) => {
  await loginAsCtv(page);
  await expect(page.getByLabel('Lịch tuần cá nhân')).toBeVisible();
  await expect(page).toHaveScreenshot(`ctv-schedule-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
  if (testInfo.project.name === 'mobile') { await page.getByRole('button', { name: 'Mở danh mục' }).click(); await page.getByRole('button', { name: 'Thông tin tài khoản' }).click(); }
  else { await page.getByRole('button', { name: /Mở menu tài khoản/i }).click(); await page.getByRole('menuitem', { name: 'Thông tin tài khoản' }).click(); }
  await expect(page).toHaveScreenshot(`ctv-profile-${testInfo.project.name}.png`, { fullPage: true, animations: 'disabled' });
});
