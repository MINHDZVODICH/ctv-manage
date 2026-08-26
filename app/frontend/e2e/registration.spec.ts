import { test, expect } from './fixtures';

test('người dùng gửi được yêu cầu đăng ký tối thiểu hợp lệ', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản' })).toBeVisible();

  await page.getByPlaceholder('Nguyễn Văn A').fill('Đăng ký từ trình duyệt');
  await page.getByPlaceholder('nguyenvana@vienkhcn.vn').fill('browser.registration@ctv.local');
  await page.getByPlaceholder('0987654321').fill('0912345678');

  const passwordInputs = page.locator('input[type="password"]');
  await expect(passwordInputs).toHaveCount(2);
  await passwordInputs.nth(0).fill('Browser@123456');
  await passwordInputs.nth(1).fill('Browser@123456');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Gửi yêu cầu đăng ký thành công!' })).toBeVisible();
});
