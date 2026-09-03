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

  const weeklySchedule = page.getByRole('heading', { name: 'Lịch tuần' }).locator('..').locator('..');
  await expect(weeklySchedule.getByLabel('Ca sáng')).toHaveCount(0);
  await expect(weeklySchedule.getByLabel('Ca chiều')).toHaveCount(0);

  await page.getByRole('button', { name: 'Đăng ký lịch làm việc', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Đăng ký lịch làm việc' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Buồng làm việc').selectOption({ label: 'Buồng 2' });
  await dialog.getByRole('button', { name: /Chọn Ca chiều Thứ 3/ }).click();
  await dialog.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page.getByText('Đăng ký thành công', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Buồng 2', { exact: true }).first()).toBeVisible();
  await expect(weeklySchedule.getByLabel('Ca sáng')).toHaveCount(0);
  await expect(weeklySchedule.getByLabel('Ca chiều')).toHaveCount(1);
  await expect(page.getByText('ROOM_2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();
  await expect(page.getByLabel(/Ca Sáng,/)).toHaveCount(0);
  await expect(page.getByLabel(/Ca Chiều,/)).toHaveCount(0);
});

test('CTV tải file hồ sơ lên và vẫn thấy sau khi tải lại trang', async ({ page, loginAs }) => {
  const openProfile = async () => {
    await page.locator('aside').getByRole('button').last().click();
    await page.getByRole('button', { name: /Hồ sơ cá nhân/ }).click();
    await expect(page.getByRole('heading', { name: 'Thông tin tài khoản', level: 2 })).toBeVisible();
  };
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  await loginAs('ctv');
  await openProfile();

  await page.getByTestId('profile-avatar').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByText('Đã thay đổi ảnh đại diện thành công', { exact: true })).toBeVisible();

  await page.getByTestId('profile-cccd-front').setInputFiles({
    name: 'cccd-front.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByText('Đã thay đổi ảnh CCCD thành công', { exact: true })).toBeVisible();

  await page.getByTestId('profile-cccd-back').setInputFiles({
    name: 'cccd-back.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByText('Đã thay đổi ảnh CCCD thành công', { exact: true })).toBeVisible();

  await page.getByTestId('profile-cv').setInputFiles({
    name: 'ho-so.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await expect(page.getByText('Đã cập nhật file CV: ho-so.pdf', { exact: true })).toBeVisible();

  await page.reload();
  await openProfile();
  await expect(page.getByAltText('CCCD Mặt trước')).toBeVisible();
  await expect(page.getByAltText('CCCD Mặt sau')).toBeVisible();
  await expect(page.getByText('ho-so.pdf', { exact: true })).toBeVisible();
  await expect(page.locator('img[alt="CTV Active"]').first()).toBeVisible();

  const cvTabPromise = page.context().waitForEvent('page');
  await page.getByRole('link', { name: 'Xem CV trong tab mới' }).click();
  const cvTab = await cvTabPromise;
  await expect.poll(() => cvTab.url()).toContain('/api/v1/files/');
  await cvTab.close();
});

test('form hồ sơ chỉ nhận chữ số cho điện thoại và ngày sinh', async ({ page, loginAs }) => {
  await loginAs('ctv');
  await page.locator('aside').getByRole('button').last().click();
  await page.getByRole('button', { name: /Hồ sơ cá nhân/ }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();

  const editProfileModal = page
    .getByRole('heading', { name: 'Chỉnh sửa thông tin cá nhân' })
    .locator('..')
    .locator('..');
  await expect(editProfileModal.getByRole('button', { name: 'Hủy' })).toHaveCount(0);
  await expect(editProfileModal.getByText('Hồ sơ ứng tuyển (CV)', { exact: true })).toHaveCount(0);
  await expect(editProfileModal.locator('input[type="file"]')).toHaveCount(0);

  const phoneInput = page.getByLabel('Số điện thoại');
  await phoneInput.fill('09ab12 34-56');
  await expect(phoneInput).toHaveValue('09123456');

  const dobInput = page.getByLabel('Ngày sinh');
  await dobInput.fill('1a5-0b4-1999');
  await expect(dobInput).toHaveValue('15/04/1999');

  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã cập nhật thông tin hồ sơ cá nhân.', { exact: true })).toBeVisible();
});
