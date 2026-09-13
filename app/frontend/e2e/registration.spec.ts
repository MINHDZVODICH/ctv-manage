import { test, expect } from './fixtures';

test('người dùng gửi được yêu cầu đăng ký kèm CCCD và CV', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  const heading = page.getByRole('heading', { name: 'Đăng ký tài khoản' });
  await expect(heading).toBeVisible();
  const form = heading.locator('..').locator('form');

  await form.locator('input[type="text"]').first().fill('Đăng ký từ trình duyệt');
  await form.locator('input[type="email"]').fill('browser.registration@ctv.local');
  await form.locator('input[type="tel"]').fill('0912345678');

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

  await expect(
    page.getByRole('heading', { name: 'Gửi yêu cầu đăng ký thành công!' }),
  ).toBeVisible();
  const responseBody = await (await registrationResponse).json();
  expect(responseBody.request.files.map((file: { category: string }) => file.category)).toEqual(
    expect.arrayContaining(['CCCD_FRONT', 'CCCD_BACK', 'CV']),
  );
});

async function checkContrastRatio(locator: import('@playwright/test').Locator): Promise<number> {
  return await locator.evaluate((el) => {
    function parseColor(colorStr: string): [number, number, number] {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return [0, 0, 0];
      ctx.fillStyle = '#000';
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2]];
    }
    function getLuminance(r: number, g: number, b: number) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    const style = window.getComputedStyle(el);
    const fg = parseColor(style.color);

    let bgEl: HTMLElement | null = el.parentElement;
    let bg: [number, number, number] = [37, 38, 43];
    while (bgEl) {
      const bgStyle = window.getComputedStyle(bgEl);
      const color = bgStyle.backgroundColor;
      if (color && color !== 'transparent' && !color.includes('rgba(0, 0, 0, 0)')) {
        bg = parseColor(color);
        break;
      }
      bgEl = bgEl.parentElement;
    }
    const l1 = getLuminance(fg[0], fg[1], fg[2]);
    const l2 = getLuminance(bg[0], bg[1], bg[2]);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  });
}

test('giao diện đăng ký ở chế độ dark mode đảm bảo độ tương phản tiêu đề và các nút upload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('ctv_sys_dark_mode', 'true');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();

  const heading = page.getByRole('heading', { name: 'Đăng ký tài khoản' });
  await expect(heading).toBeVisible();

  const cccdUploadText = page.getByText('Tải ảnh lên').first();
  await expect(cccdUploadText).toBeVisible();

  const cvUploadText = page.getByText('Tải file CV lên');
  await expect(cvUploadText).toBeVisible();

  const headingRatio = await checkContrastRatio(heading);
  expect(headingRatio).toBeGreaterThanOrEqual(4.5);

  const cccdRatio = await checkContrastRatio(cccdUploadText);
  expect(cccdRatio).toBeGreaterThanOrEqual(4.5);

  const cvRatio = await checkContrastRatio(cvUploadText);
  expect(cvRatio).toBeGreaterThanOrEqual(4.5);
});

test('cảnh báo đỏ hiển thị khi thiếu thông tin bắt buộc và biến mất khi người dùng nhấn vào ô lỗi', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản' })).toBeVisible();

  // Bấm đăng ký khi chưa điền thông tin
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  // Kiểm tra các thông tin bắt buộc phải có cảnh báo đỏ
  const nameError = page.getByText('Vui lòng nhập họ và tên!');
  const emailError = page.getByText('Vui lòng nhập email!');
  const cccdFrontError = page.getByText('Vui lòng tải ảnh CCCD mặt trước!');
  const cccdBackError = page.getByText('Vui lòng tải ảnh CCCD mặt sau!');
  const passwordError = page.getByText('Vui lòng nhập mật khẩu!');
  const confirmPasswordError = page.getByText('Vui lòng nhập lại mật khẩu!');

  await expect(nameError).toBeVisible();
  await expect(emailError).toBeVisible();
  await expect(cccdFrontError).toBeVisible();
  await expect(cccdBackError).toBeVisible();
  await expect(passwordError).toBeVisible();
  await expect(confirmPasswordError).toBeVisible();

  // Số điện thoại không bắt buộc -> không được có lỗi số điện thoại
  await expect(page.getByText('Vui lòng nhập số điện thoại!')).toHaveCount(0);

  // Khi người dùng nhấn vào ô Họ và tên -> cảnh báo Họ và tên phải mất đi
  const nameInput = page.locator('input[type="text"]').first();
  await nameInput.click();
  await expect(nameError).toHaveCount(0);

  // Khi người dùng nhấn vào ô Email -> cảnh báo Email phải mất đi
  const emailInput = page.locator('input[type="email"]');
  await emailInput.click();
  await expect(emailError).toHaveCount(0);

  // Khi người dùng nhấn vào khung CCCD mặt trước -> cảnh báo CCCD mặt trước phải mất đi
  const cccdFrontDropzone = page.getByTestId('registration-cccd-front-dropzone');
  await cccdFrontDropzone.click({ force: true });
  await expect(cccdFrontError).toHaveCount(0);

  // Khi người dùng nhấn vào khung CCCD mặt sau -> cảnh báo CCCD mặt sau phải mất đi
  const cccdBackDropzone = page.getByTestId('registration-cccd-back-dropzone');
  await cccdBackDropzone.click({ force: true });
  await expect(cccdBackError).toHaveCount(0);

  // Khi người dùng nhấn vào ô Mật khẩu -> cảnh báo Mật khẩu phải mất đi
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).click();
  await expect(passwordError).toHaveCount(0);

  // Khi người dùng nhấn vào ô Nhập lại mật khẩu -> cảnh báo Nhập lại mật khẩu phải mất đi
  await passwordInputs.nth(1).click();
  await expect(confirmPasswordError).toHaveCount(0);
});

test('người dùng gửi yêu cầu đăng ký thành công mà không cần số điện thoại', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
  const heading = page.getByRole('heading', { name: 'Đăng ký tài khoản' });
  await expect(heading).toBeVisible();
  const form = heading.locator('..').locator('form');

  await form.locator('input[type="text"]').first().fill('Đăng ký Không SĐT');
  await form.locator('input[type="email"]').fill('no.phone.registration@ctv.local');

  const passwordInputs = page.locator('input[type="password"]');
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

  const registrationResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/registration-requests') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: 'Gửi yêu cầu đăng ký thành công!' }),
  ).toBeVisible();
  const responseBody = await (await registrationResponse).json();
  expect(responseBody.request.displayName).toBe('Đăng ký Không SĐT');
  expect(responseBody.request.phone).toBeNull();
});
