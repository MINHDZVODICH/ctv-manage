import { test, expect } from './fixtures';

test.describe('Đăng nhập và bố cục thông báo lỗi', () => {
  test('hiển thị lỗi trường ngay dưới và căn phải, không có nền đỏ', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    const errors = page.getByText('Vui lòng nhập trường này!', { exact: true });
    await expect(errors).toHaveCount(2);

    const inputs = [page.locator('input[type="email"]'), page.locator('input[type="password"]')];
    for (let index = 0; index < inputs.length; index += 1) {
      const inputBox = await inputs[index].boundingBox();
      const error = errors.nth(index);
      const errorBox = await error.boundingBox();
      expect(inputBox).not.toBeNull();
      expect(errorBox).not.toBeNull();
      expect(errorBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
      await expect(error).toHaveCSS('text-align', 'right');
      await expect(error).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
  });

  test('hiển thị lỗi sai thông tin ngay dưới tiêu đề Đăng nhập', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill('wrong@ctv.local');
    await page.locator('input[type="password"]').fill('Wrong@123456');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    const heading = page.getByRole('heading', { name: 'Đăng nhập', exact: true });
    const error = page.getByText('Email hoặc mật khẩu không đúng', { exact: true });
    const emailInput = page.locator('input[type="email"]');
    await expect(error).toBeVisible();

    const headingBox = await heading.boundingBox();
    const errorBox = await error.boundingBox();
    const inputBox = await emailInput.boundingBox();
    expect(errorBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height);
    expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(inputBox!.y);
    await expect(error).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('Admin đăng nhập, không còn nút đổi vai trò, và đăng xuất được', async ({ page, loginAs }) => {
    await loginAs('admin');
    await expect(page.getByRole('heading', { name: 'Danh sách tài khoản' })).toBeVisible();
    await expect(page.getByText('Chuyển vai trò', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Đổi sang Cộng tác viên', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /Admin Acceptance/ }).click();
    await page.getByRole('button').filter({ hasText: 'Đăng xuất' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
  });
});
