import { expect, type Page } from '@playwright/test';

export async function freezeToE2eDate(page: Page) {
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate('2026-08-25T10:00:00+07:00').valueOf();
    // Keep Date APIs deterministic for visual and schedule assertions only in Playwright's page realm.
    // @ts-expect-error Date constructor replacement preserves the public constructor shape.
    window.Date = class extends RealDate { constructor(value?: string | number | Date) { super(value === undefined ? fixed : value); } static now() { return fixed; } };
  });
}

export async function login(page: Page, email: string) {
  await freezeToE2eDate(page);
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.locator('#login-password').fill('E2ePass123');
  await page.getByRole('button', { name: /^Đăng nhập$/i }).click();
  await expect(page.getByRole('status')).toContainText('Đăng nhập thành công');
}

export async function loginAsAdmin(page: Page) { await login(page, 'admin.e2e@ctv.local'); }
export async function loginAsCtv(page: Page) { await login(page, 'ctv.e2e@ctv.local'); }
