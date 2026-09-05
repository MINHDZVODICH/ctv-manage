import { test, expect } from './fixtures';

test('CTV đăng ký lịch làm việc (Buồng 1, T2 sáng, T3 chiều) và dữ liệu được đồng nhất', async ({ page, loginAs }) => {
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
  await expect(page.getByText('Chưa có ca làm việc đã hoàn thành trong tháng này.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lịch tuần', exact: true }).click();

  const weeklySchedule = page.getByTestId('weekly-schedule');
  await expect(weeklySchedule.getByText('Ca Sáng', { exact: true })).toHaveCount(0);
  await expect(weeklySchedule.getByText('Ca Chiều', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Đăng ký lịch làm việc', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Đăng ký lịch làm việc' });
  await expect(dialog).toBeVisible();
  const patternButtons = dialog.locator('fieldset button');
  await expect(patternButtons).toHaveCount(10);
  await expect(dialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(0);
  await expect(dialog.getByLabel('Buồng làm việc')).toBeFocused();

  await dialog.getByLabel('Buồng làm việc').selectOption({ label: 'Buồng 1' });
  await dialog.getByRole('button', { name: /Chọn Ca sáng Thứ 2/ }).click();
  await dialog.getByRole('button', { name: /Chọn Ca chiều Thứ 3/ }).click();
  await dialog.getByRole('button', { name: 'Đăng ký', exact: true }).click();

  await expect(page.getByText('Đăng ký thành công', { exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Buồng 1', { exact: true }).first()).toBeVisible();
  await expect(weeklySchedule.getByText('Ca Sáng', { exact: true })).toHaveCount(1);
  await expect(weeklySchedule.getByText('Ca Chiều', { exact: true })).toHaveCount(1);
  // Shift cards are read-only divs, not interactive buttons
  const morningBadge = weeklySchedule.getByLabel(/Ca Sáng, Thứ 2/);
  await expect(morningBadge).toBeVisible();
  await expect(weeklySchedule.getByRole('button', { name: /Ca Sáng, Thứ 2/ })).toHaveCount(0);
  await morningBadge.click();
  await expect(page.getByRole('dialog', { name: /Chi tiết ca/ })).toHaveCount(0);

  await expect(weeklySchedule.getByText('Lặp lại đến khi bạn cập nhật', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem tuần trước' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem tuần sau' })).toHaveCount(0);
  await expect(page.getByText('ROOM_1', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();
  await expect(page.getByLabel(/Ca Sáng,/)).toHaveCount(0);
  await expect(page.getByLabel(/Ca Chiều,/)).toHaveCount(0);
  await expect(page.getByText('Chưa có ca làm việc đã hoàn thành trong tháng này.')).toHaveCount(0);
});

test('Mẫu ca làm việc theo tuần điền sẵn ca đã đăng ký và cho phép lưu khi không chọn ca nào (0 ca)', async ({ page, loginAs }) => {
  await loginAs('ctv');

  // 1. Khi đã có lịch, nút đổi thành "Cập nhật" và modal điền sẵn ca đã đăng ký
  const updateBtn = page.getByRole('button', {
    name: 'Cập nhật',
    exact: true,
  });
  await expect(updateBtn).toBeVisible();
  await updateBtn.click();

  const updateDialog = page.getByRole('dialog', { name: 'Cập nhật lịch làm việc' });
  await expect(updateDialog).toBeVisible();
  await expect(updateDialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(2);
  await expect(updateDialog.getByLabel('Buồng làm việc')).toHaveValue('Buồng 1');

  // 2. Không còn nút "Xóa toàn bộ lịch"
  await expect(updateDialog.getByRole('button', { name: /Xóa toàn bộ lịch/ })).toHaveCount(0);

  // 3. Bỏ chọn tất cả ca và bấm lưu -> lưu thành công 0 ca
  await updateDialog.getByRole('button', { name: /Bỏ chọn Ca sáng Thứ 2/ }).click();
  await updateDialog.getByRole('button', { name: /Bỏ chọn Ca chiều Thứ 3/ }).click();
  await expect(updateDialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(0);
  await updateDialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Cập nhật lịch làm việc thành công', { exact: true })).toBeVisible();
  await expect(updateDialog).toBeHidden();

  // Kiểm tra lịch tuần không còn ca nào
  const weeklySchedule = page.getByTestId('weekly-schedule');
  await expect(weeklySchedule.getByText('Ca Sáng', { exact: true })).toHaveCount(0);
  await expect(weeklySchedule.getByText('Ca Chiều', { exact: true })).toHaveCount(0);

  // 4. Mở lại "Cập nhật", chọn lại T2 sáng, cập nhật buồng sang Buồng 2, và lưu thành công
  await updateBtn.click();
  await expect(updateDialog).toBeVisible();
  await expect(updateDialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(0);
  await updateDialog.getByRole('button', { name: /Chọn Ca sáng Thứ 2/ }).click();
  await expect(updateDialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(1);
  await updateDialog.getByLabel('Buồng làm việc').selectOption({ label: 'Buồng 2' });
  await updateDialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();

  await expect(page.getByText('Cập nhật lịch làm việc thành công', { exact: true })).toBeVisible();
  await expect(updateDialog).toBeHidden();

  await expect(weeklySchedule.getByText('Ca Sáng', { exact: true })).toHaveCount(1);
  await expect(weeklySchedule.getByText('Ca Chiều', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Buồng 2', { exact: true }).first()).toBeVisible();

  // Mở lại để kiểm tra thay đổi được lưu bền vững và đóng bằng nút X
  await updateBtn.click();
  await expect(updateDialog).toBeVisible();
  await expect(updateDialog.locator('fieldset button[aria-pressed="true"]')).toHaveCount(1);
  await expect(updateDialog.getByLabel('Buồng làm việc')).toHaveValue('Buồng 2');
  await updateDialog.getByRole('button', { name: 'Đóng cửa sổ đăng ký', exact: true }).click();
  await expect(updateDialog).toBeHidden();
});

test('Lịch tuần vẫn hiện assignment khi metadata đăng ký tải lỗi', async ({ page, loginAs }) => {
  await loginAs('ctv');
  await page.evaluate(async () => {
    const currentResponse = await fetch('/api/v1/users/me/schedule-registration');
    const currentBody = await currentResponse.json();
    const current = currentBody.data ?? currentBody;
    const response = await fetch('/api/v1/users/me/schedule-registration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'ROOM_1',
        slots: [{ weekday: 1, period: 'MORNING' }],
        expectedVersion: current?.version,
      }),
    });
    await response.json();
  });

  await page.route('**/api/v1/users/me/schedule-registration', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'metadata unavailable' } }),
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Không thể tải lại lịch làm việc.', { exact: true })).toBeVisible();

  await expect(page.getByTestId('weekly-schedule').getByText('Ca Sáng', { exact: true })).toHaveCount(1);
});

test('Lịch tuần không bị sidebar desktop che trên màn hình mobile', async ({ page, loginAs }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs('ctv');

  await expect(page.locator('aside').first()).toBeHidden();
  await expect(page.getByTestId('weekly-schedule')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lịch tuần' })).toBeVisible();
  await expect(page.getByText('Lặp lại đến khi bạn cập nhật', { exact: true })).toHaveCount(0);
});

test('Lịch sử làm việc hiển thị dữ liệu và cho phép thử lại sau lỗi tải', async ({ page, loginAs }) => {
  await loginAs('ctv');
  const accountId = await page.evaluate(async () => {
    const response = await fetch('/api/v1/users/me');
    const body = await response.json();
    return body.data?.id ?? body.user?.id ?? body.id;
  });

  const now = new Date();
  const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetMonth = `${targetMonthDate.getFullYear()}-${String(targetMonthDate.getMonth() + 1).padStart(2, '0')}`;
  let targetDay = 1;
  while ([0, 6].includes(new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), targetDay).getDay())) {
    targetDay += 1;
  }
  const workDate = `${targetMonth}-${String(targetDay).padStart(2, '0')}`;
  let targetMonthAttempts = 0;

  await page.route('**/api/v1/users/me/work-history?*', async (route) => {
    const month = new URL(route.request().url()).searchParams.get('month');
    if (month !== targetMonth) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { month, entries: [] } }) });
      return;
    }
    targetMonthAttempts += 1;
    if (targetMonthAttempts === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'temporary failure' } }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          month: targetMonth,
          entries: [{
            id: 'history-shift-1',
            workDate,
            period: 'MORNING',
            roomCode: 'ROOM_1',
          }],
        },
      }),
    });
  });

  await page.getByRole('button', { name: 'Lịch sử làm việc', exact: true }).click();
  await page.getByRole('button', { name: 'Xem tháng trước' }).click();
  await expect(page.getByRole('alert')).toContainText('Không thể tải lịch sử làm việc.');
  await page.getByRole('button', { name: 'Thử lại' }).click();
  const historyMorning = page.getByLabel(/Ca Sáng,/);
  await expect(historyMorning).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Ca Sáng,/ })).toHaveCount(0);
  await historyMorning.click();
  await expect(page.getByRole('dialog', { name: /Chi tiết ca/ })).toHaveCount(0);
  await expect(page.getByText('COMPLETED')).toHaveCount(0);
  await expect(page.getByText('Chưa có ca làm việc đã hoàn thành trong tháng này.')).toHaveCount(0);
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
  await expect(editProfileModal.getByRole('button', { name: 'Hủy' })).toBeVisible();
  await expect(editProfileModal.getByText('Hồ sơ ứng tuyển (CV)', { exact: true })).toHaveCount(0);
  await expect(editProfileModal.locator('input[type="file"]')).toHaveCount(0);

  const phoneInput = page.getByLabel('Số điện thoại');
  await phoneInput.fill('09ab12 34-56');
  await expect(phoneInput).toHaveValue('09123456');

  await editProfileModal.getByTitle('Ngày').selectOption('15');
  await editProfileModal.getByTitle('Tháng').selectOption('04');
  await editProfileModal.getByTitle('Năm').selectOption('1999');
  await expect(editProfileModal.getByTitle('Ngày')).toHaveValue('15');
  await expect(editProfileModal.getByTitle('Tháng')).toHaveValue('04');
  await expect(editProfileModal.getByTitle('Năm')).toHaveValue('1999');

  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã cập nhật thông tin hồ sơ cá nhân.', { exact: true })).toBeVisible();
});
