import { test, expect } from './fixtures';

test('CTV đăng ký lịch định kỳ và dữ liệu được tải lại', async ({ page, loginAs }) => {
  await loginAs('ctv');
  await page.route('**/api/v1/users/me/work-history?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đang tải...');
  await expect(page.getByText('Đang tải lịch sử làm việc...', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Ca Sáng,/)).toHaveCount(0);
  await expect(page.getByLabel(/Ca Chiều,/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Lịch tuần', exact: true }).click();

  await page.getByRole('button', { name: 'Đăng ký lịch làm việc', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Đăng ký lịch làm việc' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Buồng làm việc').selectOption({ label: 'Buồng 2' });
  await dialog.getByRole('button', { name: /Chọn Ca chiều Thứ 3/ }).click();
  await dialog.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page.getByText('Đăng ký thành công', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Buồng 2', { exact: true }).first()).toBeVisible();
  const weeklySchedule = page.getByRole('heading', { name: 'Lịch tuần' }).locator('..').locator('..');
  await expect(weeklySchedule.getByText('Ca Sáng', { exact: true })).toHaveCount(2);
  await expect(weeklySchedule.getByText('Ca Chiều', { exact: true })).toHaveCount(2);
  await expect(page.getByText('ROOM_2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();
  await expect(page.getByLabel(/Ca Sáng,/)).toHaveCount(0);
  await expect(page.getByLabel(/Ca Chiều,/)).toHaveCount(0);
});
