// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EditProfileModal } from '../src/features/profile/components/EditProfileModal';
import type { UserAccount } from '../src/shared/types';

const mockDict: Record<string, string> = {
  'full_name': 'Họ và tên',
  'phone_number': 'Số điện thoại',
  'date_of_birth': 'Ngày sinh',
  'gender': 'Giới tính',
  'address': 'Địa chỉ',
  'save': 'Lưu thay đổi',
  'cancel': 'Hủy',
  'profile.edit_title': 'Chỉnh sửa thông tin cá nhân',
  'profile.day': 'Ngày',
  'profile.month': 'Tháng',
  'profile.year': 'Năm',
  'profile.phone_hint': 'Số điện thoại gồm 10 hoặc 11 chữ số',
  'profile.error_name_required': 'Vui lòng nhập họ và tên!',
  'profile.error_phone_format': 'Số điện thoại phải gồm 10 hoặc 11 chữ số!',
  'profile.error_dob_incomplete': 'Vui lòng chọn đầy đủ ngày, tháng, năm sinh hoặc để trống!',
};

vi.mock('../src/shared/context/SystemSettingsContext', () => ({
  useSystemSettings: () => ({
    t: (key: string) => mockDict[key] || key,
    language: 'vi',
  }),
}));

const mockUser: UserAccount = {
  id: 'user-1',
  stt: 1,
  name: 'Nguyễn Văn A',
  email: 'vana@example.com',
  phone: '0988123456',
  role: 'Cộng tác viên',
  status: 'Kích hoạt',
  registerDate: '2026-01-01',
  dob: '15/06/1988',
  gender: 'Nam',
  address: 'Hà Nội',
};

describe('EditProfileModal — Cancel button removal, backdrop lock, phone & DOB validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT render a Cancel/Hủy button, only renders Save and close X button', () => {
    render(
      <EditProfileModal
        isOpen={true}
        user={mockUser}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    // Cancel button should NOT exist in document
    expect(screen.queryByRole('button', { name: 'Hủy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    // Save button must exist
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDefined();

    // Close button X must exist
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toBeDefined();
  });

  it('does NOT close when clicking on the backdrop outside the modal dialog', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <EditProfileModal
        isOpen={true}
        user={mockUser}
        onClose={handleClose}
        onSave={vi.fn()}
      />,
    );

    // Outer backdrop container
    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop).toBeDefined();

    // Click backdrop
    fireEvent.click(backdrop);
    expect(handleClose).not.toHaveBeenCalled();

    // Clicking close button X DOES close
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('allows submitting with valid 10 or 11 digit phone number', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={{ ...mockUser, phone: '0988123456' }}
        onClose={handleClose}
        onSave={handleSave}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '0988123456',
      }),
    );
  });

  it('allows submitting when phone is left empty', () => {
    const handleSave = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={{ ...mockUser, phone: '' }}
        onClose={vi.fn()}
        onSave={handleSave}
      />,
    );

    const phoneInput = screen.getByLabelText('Số điện thoại');
    fireEvent.change(phoneInput, { target: { value: '' } });

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '',
      }),
    );
  });

  it('rejects submitting and shows error when phone number has fewer than 10 digits', () => {
    const handleSave = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={mockUser}
        onClose={vi.fn()}
        onSave={handleSave}
      />,
    );

    const phoneInput = screen.getByLabelText('Số điện thoại');
    fireEvent.change(phoneInput, { target: { value: '098812345' } }); // 9 digits

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).not.toHaveBeenCalled();
    expect(screen.getByText('Số điện thoại phải gồm 10 hoặc 11 chữ số!')).toBeDefined();
  });

  it('allows submitting when date of birth is completely empty', () => {
    const handleSave = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={{ ...mockUser, dob: '' }}
        onClose={vi.fn()}
        onSave={handleSave}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dob: '',
      }),
    );
  });

  it('allows submitting when date of birth has day, month, and year all filled', () => {
    const handleSave = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={{ ...mockUser, dob: '20/11/1995' }}
        onClose={vi.fn()}
        onSave={handleSave}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        dob: '20/11/1995',
      }),
    );
  });

  it('rejects submitting and shows error when date of birth is partially filled', () => {
    const handleSave = vi.fn();
    render(
      <EditProfileModal
        isOpen={true}
        user={{ ...mockUser, dob: '' }}
        onClose={vi.fn()}
        onSave={handleSave}
      />,
    );

    // Select Day but leave Month and Year empty
    const daySelect = screen.getByTitle('Ngày');
    fireEvent.change(daySelect, { target: { value: '15' } });

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    expect(handleSave).not.toHaveBeenCalled();
    expect(
      screen.getByText('Vui lòng chọn đầy đủ ngày, tháng, năm sinh hoặc để trống!'),
    ).toBeDefined();
  });
});
