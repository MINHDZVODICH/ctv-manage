import { test, expect } from './fixtures';

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
