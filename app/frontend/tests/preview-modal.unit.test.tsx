// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ViewAccountDetailModal } from '../src/features/accounts/components/ViewAccountDetailModal';
import { ViewRequestModal } from '../src/features/registration/components/ViewRequestModal';
import type { UserAccount, RegistrationRequest } from '../src/shared/types';

import * as api from '../src/shared/api';

vi.mock('../src/shared/context/SystemSettingsContext', () => ({
  useSystemSettings: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'cccd_front': 'CCCD Mặt trước',
        'cccd_back': 'CCCD Mặt sau',
        'close': 'Đóng',
        'accounts.view_front': 'Xem mặt trước',
        'accounts.view_back': 'Xem mặt sau',
        'front_side': 'Mặt trước',
        'back_side': 'Mặt sau',
      };
      return dict[key] || key;
    },
    language: 'vi',
  }),
}));

describe('Preview Modal Long Name Ellipsis Truncation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'apiGet').mockResolvedValue({ data: null } as any);
    vi.spyOn(api, 'isRequestAborted').mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('truncates long titles with ellipsis and sets title attribute in ViewAccountDetailModal preview', () => {
    const longName = 'h'.repeat(120);
    const mockAccount: UserAccount = {
      id: 'acc-1',
      stt: 1,
      name: longName,
      email: 'test@example.com',
      phone: '0123456789',
      role: 'Cộng tác viên',
      status: 'Kích hoạt',
      registerDate: '2023-01-01',
      cccdFront: 'https://example.com/front.jpg',
      cccdBack: 'https://example.com/back.jpg',
    };

    render(
      <ViewAccountDetailModal
        account={mockAccount}
        shifts={[]}
        onClose={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );

    // Click on front image preview trigger
    const frontImage = screen.getByAltText('CCCD Mặt trước');
    fireEvent.click(frontImage.parentElement!);

    const expectedTitle = `CCCD Mặt trước - ${longName}`;
    const heading = screen.getByRole('heading', { level: 3, name: expectedTitle });
    expect(heading).toBeDefined();

    // Check truncation and title tooltip
    expect(heading.className).toContain('truncate');
    expect(heading.getAttribute('title')).toBe(expectedTitle);

    // Check parent container prevents flex blowout
    const parentContainer = heading.parentElement;
    expect(parentContainer?.className).toContain('min-w-0');
  });

  it('truncates long titles with ellipsis and sets title attribute in ViewRequestModal preview', () => {
    const longName = 'h'.repeat(120);
    const mockRequest: RegistrationRequest = {
      id: 'req-1',
      stt: 1,
      name: longName,
      email: 'request@example.com',
      phone: '0987654321',
      status: 'Chờ duyệt',
      submittedAt: new Date().toISOString(),
      cccdFront: 'https://example.com/front.jpg',
      cccdBack: 'https://example.com/back.jpg',
    };

    render(
      <ViewRequestModal
        request={mockRequest}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    // Find and click front preview trigger
    const frontImage = screen.getByAltText('CCCD Mặt trước');
    fireEvent.click(frontImage.parentElement!);

    const expectedTitle = `CCCD Mặt trước - ${longName}`;
    const heading = screen.getByRole('heading', { level: 3, name: expectedTitle });
    expect(heading).toBeDefined();

    // Check truncation and title tooltip
    expect(heading.className).toContain('truncate');
    expect(heading.getAttribute('title')).toBe(expectedTitle);

    // Check parent container prevents flex blowout
    const parentContainer = heading.parentElement;
    expect(parentContainer?.className).toContain('min-w-0');
  });
});
