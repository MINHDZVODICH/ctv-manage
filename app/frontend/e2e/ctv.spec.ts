import { test, expect } from './fixtures';

test('CTV đăng ký lịch định kỳ và dữ liệu được tải lại', async ({ page, loginAs }) => {
  await loginAs('ctv');
  await page.getByRole('button', { name: 'Đăng ký lịch làm việc', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Đăng ký lịch làm việc' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Buồng làm việc').selectOption({ label: 'Buồng 2' });
  await dialog.getByRole('button', { name: /Chọn Ca chiều Thứ 3/ }).click();
  await dialog.getByRole('button', { name: 'Đăng ký lịch', exact: true }).click();

  await expect(page.getByText('Đã đăng ký 4 ca mẫu trong tuần.', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Buồng 2', { exact: true }).first()).toBeVisible();
});
