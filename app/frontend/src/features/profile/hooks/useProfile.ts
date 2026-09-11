import { useState, useCallback } from 'react';
import * as profileApi from '../api/profileApi';
import { UserAccount } from '../../../shared/types';
import { ProfileFileKind } from '../types';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';

interface UseProfileOptions {
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
  onRefreshUser?: () => Promise<any>;
}

export const useProfile = (options?: UseProfileOptions) => {
  const { t } = useSystemSettings();
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
        options?.onSuccess?.(t('profile.update_success'));
        return true;
      } catch (err: any) {
        const msg = err.message ?? t('profile.update_failed');
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options, t]
  );

  const updateAvatar = useCallback(
    async (dataUrl: string) => {
      setLoading(true);
      setError(null);
      try {
        if (!dataUrl) {
          await profileApi.deleteMyFile('AVATAR');
          options?.onSuccess?.(t('profile.delete_photo'));
        } else {
          const blob = await (await fetch(dataUrl)).blob();
          await profileApi.uploadMyFile('AVATAR', blob, 'avatar.png');
          options?.onSuccess?.(t('profile.update_success'));
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (dataUrl ? t('errors.save_failed') : t('errors.delete_failed'));
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options, t]
  );

  const updateCccd = useCallback(
    async (kind: 'CCCD_FRONT' | 'CCCD_BACK', dataUrl: string) => {
      setLoading(true);
      setError(null);
      try {
        if (!dataUrl) {
          await profileApi.deleteMyFile(kind);
          options?.onSuccess?.(t('profile.delete_photo'));
        } else {
          const blob = await (await fetch(dataUrl)).blob();
          await profileApi.uploadMyFile(kind, blob, `${kind}.png`);
          options?.onSuccess?.(t('profile.update_success'));
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (dataUrl ? t('errors.save_failed') : t('errors.delete_failed'));
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options, t]
  );

  const updateCv = useCallback(
    async (cvData: { cvFile: string; cvFileName: string; cvFileSize?: string } | null) => {
      setLoading(true);
      setError(null);
      try {
        if (!cvData) {
          await profileApi.deleteMyFile('CV');
          options?.onSuccess?.(t('app.file_deleted'));
        } else {
          const blob = await (await fetch(cvData.cvFile)).blob();
          await profileApi.uploadMyFile('CV', blob, cvData.cvFileName);
          options?.onSuccess?.(t('app.file_uploaded'));
        }
        if (options?.onRefreshUser) {
          await options.onRefreshUser();
        }
        return true;
      } catch (err: any) {
        const msg = err.message ?? (cvData ? t('errors.save_failed') : t('errors.delete_failed'));
        setError(msg);
        options?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [options, t]
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
