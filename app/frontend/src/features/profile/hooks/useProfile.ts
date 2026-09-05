import { useState, useCallback } from 'react';
import * as profileApi from '../api/profileApi';
import { UserAccount } from '../../../types';
import { ProfileFileKind } from '../types';

interface UseProfileOptions {
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
  onRefreshUser?: () => Promise<any>;
}

export const useProfile = (options?: UseProfileOptions) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = useCallback(
    async (updated: Partial<UserAccount>) => {
      setLoading(true);
      setError(null);
      try {
        const payload: any = {};
        if (updated.name !== undefined) payload.displayName = updated.name;
        if (updated.phone !== undefined) payload.phone = updated.phone;
        if (updated.address !== undefined) payload.address = updated.address;
        if ((updated as any).gender !== undefined) payload.gender = (updated as any).gender;
        if ((updated as any).dob !== undefined) payload.dateOfBirth = (updated as any).dob;

        const meRes = await profileApi.getMyProfile();
        const version = meRes.user?.version ?? meRes.data?.version;
        if (version !== undefined) {
          payload.expectedVersion = version;
        }

        await profileApi.updateMyProfile(payload);
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        options?.onSuccess?.('Đã cập nhật thông tin hồ sơ cá nhân.');
        return true;
      } catch (err: any) {
        const msg = err.message ?? 'Cập nhật hồ sơ thất bại';
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const updateAvatar = useCallback(
    async (dataUrl: string) => {
      setLoading(true);
      setError(null);
      try {
        if (!dataUrl) {
          await profileApi.deleteMyFile('AVATAR');
          options?.onSuccess?.('Đã xóa ảnh đại diện');
        } else {
          const blob = await (await fetch(dataUrl)).blob();
          await profileApi.uploadMyFile('AVATAR', blob, 'avatar.png');
          options?.onSuccess?.('Đã thay đổi ảnh đại diện thành công');
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (dataUrl ? 'Tải ảnh thất bại' : 'Xóa ảnh thất bại');
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const updateCccd = useCallback(
    async (kind: 'CCCD_FRONT' | 'CCCD_BACK', dataUrl: string) => {
      setLoading(true);
      setError(null);
      const kindLabel = kind === 'CCCD_FRONT' ? 'mặt trước' : 'mặt sau';
      try {
        if (!dataUrl) {
          await profileApi.deleteMyFile(kind);
          options?.onSuccess?.(`Đã xóa ảnh CCCD ${kindLabel}`);
        } else {
          const blob = await (await fetch(dataUrl)).blob();
          await profileApi.uploadMyFile(kind, blob, `${kind}.png`);
          options?.onSuccess?.('Đã thay đổi ảnh CCCD thành công');
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (dataUrl ? 'Tải ảnh CCCD thất bại' : 'Xóa ảnh thất bại');
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const updateCv = useCallback(
    async (cvData: { cvFile: string; cvFileName: string; cvFileSize?: string } | null) => {
      setLoading(true);
      setError(null);
      try {
        if (!cvData) {
          await profileApi.deleteMyFile('CV');
          options?.onSuccess?.('Đã xóa file CV');
        } else {
          const blob = await (await fetch(cvData.cvFile)).blob();
          await profileApi.uploadMyFile('CV', blob, cvData.cvFileName);
          options?.onSuccess?.(`Đã cập nhật file CV: ${cvData.cvFileName}`);
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (cvData ? 'Tải CV thất bại' : 'Xóa CV thất bại');
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return {
    loading,
    error,
    saveProfile,
    updateAvatar,
    updateCccd,
    updateCv,
  };
};
