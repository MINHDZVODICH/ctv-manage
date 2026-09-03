import { test, expect } from './fixtures';

test('người dùng gửi được yêu cầu đăng ký kèm CCCD và CV', async ({ page }) => {
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

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByTestId('registration-cccd-front').setInputFiles({
    name: 'cccd-front.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByTestId('registration-cccd-back').setInputFiles({
    name: 'cccd-back.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByTestId('registration-cv').setInputFiles({
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });

  const registrationResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/registration-requests') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Gửi yêu cầu đăng ký thành công!' })).toBeVisible();
  const responseBody = await (await registrationResponse).json();
  expect(responseBody.request.files.map((file: { category: string }) => file.category)).toEqual(
    expect.arrayContaining(['CCCD_FRONT', 'CCCD_BACK', 'CV']),
  );
});
