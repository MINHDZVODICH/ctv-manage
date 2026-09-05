import { test as base, expect, type Page } from '@playwright/test';

export const credentials = {
  admin: { email: 'admin.acceptance@ctv.local', password: 'Test@123456' },
  ctv: { email: 'ctv.active@ctv.local', password: 'Test@123456' },
} as const;

type Fixtures = {
  loginAs: (role: keyof typeof credentials) => Promise<void>;
  assertNoPageErrors: void;
};

async function login(page: Page, role: keyof typeof credentials) {
  const account = credentials[role];
  await page.goto('/');
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  if (role === 'admin') {
    await expect(page.getByRole('heading', { name: 'Quản lý tài khoản' })).toBeVisible();
  } else {
    await expect(
      page.getByRole('button', { name: /Đăng ký lịch làm việc|Cập nhật/ }),
    ).toBeVisible();
  }
}

export const test = base.extend<Fixtures>({
  assertNoPageErrors: [
    async ({ page }, use) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await use();
      expect(pageErrors, 'Trang không được phát sinh lỗi JavaScript chưa xử lý').toEqual([]);
    },
    { auto: true },
  ],
  loginAs: async ({ page }, use) => {
    await use((role) => login(page, role));
  },
});

export { expect };
