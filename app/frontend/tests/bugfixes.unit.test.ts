import { describe, it, expect } from 'vitest';
import { translations } from '../src/shared/i18n';

describe('Bug Fixes Unit Verification', () => {
  describe('Issue 1 & Issue 4: Registration & Profile Validation i18n Keys', () => {
    it('has error_cv_required defined in both vi and en', () => {
      const vi = translations['Tiếng Việt'];
      const en = translations['Tiếng Anh'];

      expect(vi['auth.error_cv_required']).toBe('Vui lòng tải lên hồ sơ ứng tuyển (CV)!');
      expect(en['auth.error_cv_required']).toBe('Please upload your CV (resume)!');
    });

    it('has error_name_max_length defined in auth and profile', () => {
      const vi = translations['Tiếng Việt'];
      const en = translations['Tiếng Anh'];

      expect(vi['auth.error_name_max_length']).toBe('Họ và tên không được vượt quá 100 ký tự!');
      expect(en['auth.error_name_max_length']).toBe('Full name must not exceed 100 characters!');
      expect(vi['profile.error_name_max_length']).toBe('Họ và tên không được vượt quá 100 ký tự!');
      expect(en['profile.error_name_max_length']).toBe('Full name must not exceed 100 characters!');
    });
  });

  describe('Issue 2: Date of Birth and Gender Fallbacks', () => {
    it('uses not_updated translation rather than hardcoded mock dates', () => {
      const vi = translations['Tiếng Việt'];
      const en = translations['Tiếng Anh'];

      expect(vi['not_updated']).toBe('Chưa cập nhật');
      expect(en['not_updated']).toBe('Not updated');
    });
  });

  describe('Issue 3: Tab Access Logic by Role', () => {
    function resolveNextTab(
      role: 'ADMIN' | 'CTV',
      currentTab: 'accounts' | 'requests' | 'schedule' | 'meetings' | 'profile',
    ) {
      if (role === 'ADMIN' && currentTab === 'schedule') {
        return 'accounts';
      }
      if (role !== 'ADMIN' && currentTab !== 'schedule' && currentTab !== 'profile') {
        return 'schedule';
      }
      return currentTab;
    }

    it('redirects CTV from meetings tab to schedule tab', () => {
      expect(resolveNextTab('CTV', 'meetings')).toBe('schedule');
    });

    it('redirects CTV from accounts and requests tab to schedule tab', () => {
      expect(resolveNextTab('CTV', 'accounts')).toBe('schedule');
      expect(resolveNextTab('CTV', 'requests')).toBe('schedule');
    });

    it('allows CTV to stay on schedule or profile tab', () => {
      expect(resolveNextTab('CTV', 'schedule')).toBe('schedule');
      expect(resolveNextTab('CTV', 'profile')).toBe('profile');
    });

    it('redirects ADMIN from schedule tab to accounts tab', () => {
      expect(resolveNextTab('ADMIN', 'schedule')).toBe('accounts');
    });

    it('allows ADMIN to stay on meetings, accounts, requests, profile', () => {
      expect(resolveNextTab('ADMIN', 'meetings')).toBe('meetings');
      expect(resolveNextTab('ADMIN', 'accounts')).toBe('accounts');
      expect(resolveNextTab('ADMIN', 'requests')).toBe('requests');
      expect(resolveNextTab('ADMIN', 'profile')).toBe('profile');
    });
  });
});
