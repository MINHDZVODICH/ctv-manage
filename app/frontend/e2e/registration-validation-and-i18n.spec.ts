import { test, expect } from './fixtures';

test.describe('Registration validation and English translations', () => {
  test('Lỗi mật khẩu dưới 6 ký tự hiển thị ở ô Mật khẩu và KHÔNG hiển thị ở ô Họ và tên', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản' })).toBeVisible();

    const form = page.locator('form');
    // Nhập họ và tên hợp lệ (có dấu, hoa thường, khoảng trắng)
    const nameInput = form.locator('input[type="text"]').first();
    await nameInput.fill('Trường Con Ninh Đạm');

    // Nhập mật khẩu quá ngắn (< 6 ký tự)
    const passwordInputs = form.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('123');
    await passwordInputs.nth(1).fill('123');

    // Bấm Đăng ký
    await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();

    // Lỗi mật khẩu phải hiển thị
    const passwordError = page.getByText('Mật khẩu phải có ít nhất 6 ký tự!');
    await expect(passwordError).toBeVisible();

    // Ô Họ và tên KHÔNG được chứa thông báo lỗi mật khẩu
    const nameContainer = nameInput.locator('..');
    await expect(nameContainer.getByText('Mật khẩu phải có ít nhất 6 ký tự!')).toHaveCount(0);
    await expect(nameContainer.getByText('Vui lòng nhập họ và tên!')).toHaveCount(0);
  });

  test('Khi chuyển ngôn ngữ sang Tiếng Anh, các modal được dịch đầy đủ', async ({ page, loginAs }) => {
    await loginAs('ctv');

    // 1. Mở Cài đặt hệ thống từ Sidebar user menu và chuyển sang Tiếng Anh
    await page.locator('aside').getByRole('button').last().click();
    await page.getByRole('menuitem', { name: /Cài đặt hệ thống|System Settings/i }).click();
    const settingsModal = page.locator('div.fixed.inset-0').last();
    await expect(settingsModal.getByRole('heading', { name: /Cài đặt hệ thống|System Settings/i })).toBeVisible();

    // Chọn ngôn ngữ Tiếng Anh
    await settingsModal.getByText('Tiếng Việt').last().click();
    await page.getByText('English').click();

    // Kiểm tra Accent Color dropdown hiển thị tiếng Anh (ví dụ Blue)
    await expect(settingsModal.getByText('Accent Color')).toBeVisible();
    await expect(settingsModal.getByText('Blue')).toBeVisible();

    // Đóng settings modal
    await settingsModal.locator('button:has(.material-symbols-outlined:text("close"))').click();

    // 2. Kiểm tra Modal Đăng ký/Cập nhật lịch làm việc (Shift Schedule)
    const scheduleBtn = page.getByRole('button', { name: /Update|Register Shift Schedule|Đăng ký lịch làm việc|Cập nhật lịch làm việc/i });
    await scheduleBtn.click();

    const scheduleModal = page.getByRole('dialog');
    await expect(scheduleModal).toBeVisible();
    // Tiêu đề tiếng Anh
    await expect(scheduleModal.getByText(/Update Shift Schedule|Register Shift Schedule/)).toBeVisible();
    // Label buồng làm việc tiếng Anh
    await expect(scheduleModal.getByText('Workroom', { exact: true })).toBeVisible();
    // Options buồng làm việc tiếng Anh
    await expect(scheduleModal.locator('select option').first()).toContainText('Room');
    // Mẫu ca làm việc theo tuần
    await expect(scheduleModal.getByText('Weekly Shift Schedule Pattern')).toBeVisible();
    // Header bảng: Shift / Day, Mon, Tue, Wed, Thu, Fri
    await expect(scheduleModal.getByText('Shift / Day')).toBeVisible();
    await expect(scheduleModal.getByText('Mon')).toBeVisible();
    // Ca sáng / Ca chiều tiếng Anh
    await expect(scheduleModal.getByText('Morning')).toBeVisible();
    await expect(scheduleModal.getByText('Afternoon')).toBeVisible();

    // Đóng modal lịch
    await scheduleModal.locator('button:has(.material-symbols-outlined:text("close"))').click();

    // 3. Vào Thông tin tài khoản (Personal Profile) qua Sidebar user menu
    await page.locator('aside').getByRole('button').last().click();
    await page.getByRole('menuitem', { name: /Personal Profile|Hồ sơ cá nhân/i }).click();
    await expect(page.getByRole('heading', { name: /Account Information|Thông tin tài khoản/i, level: 2 })).toBeVisible();

    // Mở Change Password modal
    await page.getByRole('button', { name: /Change Password|Đổi mật khẩu/i }).click();
    const pwdModal = page.locator('div.fixed.inset-0').last();
    await expect(pwdModal.getByRole('heading', { name: /Change Password/i })).toBeVisible();
    await expect(pwdModal.getByText('Current Password', { exact: true })).toBeVisible();
    await expect(pwdModal.getByText('New Password', { exact: true })).toBeVisible();
    await expect(pwdModal.getByText('Confirm New Password', { exact: true })).toBeVisible();
    await expect(pwdModal.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible();

    // Đóng Change Password modal
    await pwdModal.locator('button:has(.material-symbols-outlined:text("close"))').click();

    // Mở Edit Profile modal
    await page.getByRole('button', { name: /Edit Profile/i }).click();
    const editModal = page.locator('div.fixed.inset-0').last();
    await expect(editModal.getByRole('heading', { name: /Edit Personal Information/i })).toBeVisible();
    await expect(editModal.getByText('Full Name')).toBeVisible();
    await expect(editModal.getByText('Phone Number')).toBeVisible();
    await expect(editModal.getByText('Date of Birth')).toBeVisible();
    await expect(editModal.getByText('Gender')).toBeVisible();
    await expect(editModal.getByText('Address')).toBeVisible();
    await expect(editModal.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(editModal.getByRole('button', { name: 'Save changes' })).toBeVisible();

    // Đóng Edit Profile modal
    await editModal.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Login and registration forms have no placeholders on any text/password fields, and Date of Birth starts empty (--)', async ({ page }) => {
    await page.goto('/');

    // 1. Check Login form placeholders
    const loginForm = page.locator('form');
    const loginEmailInput = loginForm.locator('input[type="email"]');
    const loginPasswordInput = loginForm.locator('input[type="password"]');
    expect(await loginEmailInput.getAttribute('placeholder')).toBeFalsy();
    expect(await loginPasswordInput.getAttribute('placeholder')).toBeFalsy();

    // 2. Open Registration form
    await page.getByRole('button', { name: 'Tạo tài khoản mới' }).click();
    await expect(page.getByRole('heading', { name: 'Đăng ký tài khoản' })).toBeVisible();

    const regForm = page.locator('form');
    const nameInput = regForm.locator('input[type="text"]').first();
    const emailInput = regForm.locator('input[type="email"]');
    const phoneInput = regForm.locator('input[type="tel"]');
    const passwordInputs = regForm.locator('input[type="password"]');

    // Placeholders must be empty or absent
    expect(await nameInput.getAttribute('placeholder')).toBeFalsy();
    expect(await emailInput.getAttribute('placeholder')).toBeFalsy();
    expect(await phoneInput.getAttribute('placeholder')).toBeFalsy();
    expect(await passwordInputs.nth(0).getAttribute('placeholder')).toBeFalsy();
    expect(await passwordInputs.nth(1).getAttribute('placeholder')).toBeFalsy();

    // Date of Birth selects must default to empty ("") with "--"
    const selects = regForm.locator('select');
    await expect(selects.nth(0)).toHaveValue('');
    await expect(selects.nth(1)).toHaveValue('');
    await expect(selects.nth(2)).toHaveValue('');
  });

  test('Pending account shows awaiting approval notice on login with valid password, and English branding displays Academy of Military Science and Technology', async ({ page }) => {
    await page.goto('/');

    // 1. Check Vietnamese pending notice
    const loginForm = page.locator('form');
    await loginForm.locator('input[type="email"]').fill('pending.acceptance@ctv.local');
    await loginForm.locator('input[type="password"]').fill('Test@123456');
    await loginForm.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page.getByText('Tài khoản đang được chờ duyệt')).toBeVisible();

    // 2. Switch to English language via localStorage
    await page.evaluate(() => {
      localStorage.setItem('ctv_sys_language', 'Tiếng Anh');
    });
    await page.reload();

    // 3. Verify English organization branding
    await expect(page.getByText('ACADEMY OF MILITARY SCIENCE AND TECHNOLOGY')).toBeVisible();

    // 4. Check English pending notice
    const enLoginForm = page.locator('form');
    await enLoginForm.locator('input[type="email"]').fill('pending.acceptance@ctv.local');
    await enLoginForm.locator('input[type="password"]').fill('Test@123456');
    await enLoginForm.getByRole('button', { name: 'Log In' }).click();

    await expect(page.getByText('The account is awaiting approval')).toBeVisible();
  });
});

