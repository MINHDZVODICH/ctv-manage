// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Sidebar } from '../src/shared/ui/Sidebar';

vi.mock('../src/shared/context/SystemSettingsContext', () => ({
  useSystemSettings: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'nav_accounts': 'Quản lý tài khoản',
        'nav_requests': 'Yêu cầu đăng ký',
        'nav_summary': 'Lịch làm việc tổng hợp',
        'nav_my_schedule': 'Lịch của tôi',
      };
      return dict[key] || key;
    },
    language: 'vi',
  }),
}));

describe('Sidebar Pending Requests Badge Accent Color Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders badge with accent color when requests tab is inactive', () => {
    render(
      <Sidebar
        currentTab="accounts"
        onSelectTab={vi.fn()}
        pendingRequestsCount={51}
        onLogout={vi.fn()}
        userRole="Admin"
      />,
    );

    const badge = screen.getByText('51');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('bg-accent');
    expect(badge.className).not.toContain('bg-[#EA580C]');
  });

  it('renders badge with inverted high contrast accent styling when requests tab is active', () => {
    render(
      <Sidebar
        currentTab="requests"
        onSelectTab={vi.fn()}
        pendingRequestsCount={51}
        onLogout={vi.fn()}
        userRole="Admin"
      />,
    );

    const badge = screen.getByText('51');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-accent');
    expect(badge.className).toContain('bg-white');
    expect(badge.className).not.toContain('bg-[#EA580C]');
  });

  it('renders collapsed badge with accent color', () => {
    render(
      <Sidebar
        currentTab="accounts"
        onSelectTab={vi.fn()}
        pendingRequestsCount={51}
        onLogout={vi.fn()}
        userRole="Admin"
        isCollapsed={true}
      />,
    );

    const badge = screen.getByText('51');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('bg-accent');
    expect(badge.className).not.toContain('bg-[#EA580C]');
  });
});
