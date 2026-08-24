import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import type { AccountDetail, FileCategory } from '../accounts/useAccounts';
import { isVersionConflict, messageFor } from '../accounts/useAccounts';

export interface ProfileUpdate {
  displayName?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<AccountDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProfile(await apiClient.get<AccountDetail>('/users/me')); }
    catch (reason) { setError(messageFor(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const update = async (input: ProfileUpdate) => {
    if (!profile) return 'updated' as const;
    try {
      setProfile(await apiClient.patch<AccountDetail>('/users/me', { ...input, version: profile.version }));
      return 'updated' as const;
    } catch (reason) {
      if (!isVersionConflict(reason)) throw reason;
      await load();
      return 'conflict' as const;
    }
  };
  const replaceFile = async (category: FileCategory, file: File) => {
    const form = new FormData(); form.set('file', file);
    await apiClient.putMultipart(`/users/me/files/${slug(category)}`, form);
    await load();
  };
  const deleteFile = async (category: FileCategory) => {
    await apiClient.delete(`/users/me/files/${slug(category)}`);
    await load();
  };
  const changePassword = (currentPassword: string, newPassword: string) => (
    apiClient.post('/users/me/password-changes', { currentPassword, newPassword })
  );

  return { profile, isLoading, error, load, update, replaceFile, deleteFile, changePassword };
}

function slug(category: FileCategory): string { return category.toLowerCase().replace('_', '-'); }
