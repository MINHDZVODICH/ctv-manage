import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../shared/api/client';
import { ApiClientError } from '../../shared/api/errors';

export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RegistrationProfile {
  displayName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  password: string;
}

export interface RegistrationFiles {
  cccdFront?: File;
  cccdBack?: File;
  cv?: File;
}

export interface RegistrationRequestSummary {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  status: RegistrationStatus;
  submittedAt: string;
}

export interface RegistrationRequestDetail extends RegistrationRequestSummary {
  gender: string | null;
  address: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  files: Array<{
    id: string;
    category: 'CCCD_FRONT' | 'CCCD_BACK' | 'CV';
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

interface RegistrationPage {
  items: RegistrationRequestSummary[];
  pagination: { page: number; pageSize: number; total: number };
}

export async function submitRegistration(
  profile: RegistrationProfile,
  files: RegistrationFiles,
  idempotencyKey: string,
) {
  const form = new FormData();
  form.set('profile', JSON.stringify(profile));
  for (const [field, file] of Object.entries(files)) {
    if (file) form.set(field, file);
  }
  return apiClient.postMultipart<{ id: string; status: RegistrationStatus; submittedAt: string }>(
    '/registration-requests',
    form,
    idempotencyKey,
  );
}

export function useRegistrationSubmission() {
  const retained = useRef<{ payloadFingerprint: string; key: string } | undefined>(undefined);

  return useCallback(async (profile: RegistrationProfile, files: RegistrationFiles) => {
    const payloadFingerprint = registrationPayloadFingerprint(profile, files);
    if (retained.current?.payloadFingerprint !== payloadFingerprint) {
      retained.current = {
        payloadFingerprint,
        key: globalThis.crypto?.randomUUID?.() ?? `registration-${Date.now()}-${Math.random()}`,
      };
    }
    const result = await submitRegistration(profile, files, retained.current.key);
    retained.current = undefined;
    return result;
  }, []);
}

function registrationPayloadFingerprint(profile: RegistrationProfile, files: RegistrationFiles): string {
  return JSON.stringify({
    profile,
    files: Object.entries(files)
      .filter((entry): entry is [string, File] => Boolean(entry[1]))
      .map(([field, file]) => ({ field, name: file.name, size: file.size, type: file.type, lastModified: file.lastModified }))
      .sort((left, right) => left.field.localeCompare(right.field)),
  });
}

export function useRegistrationRequests() {
  const [page, setPage] = useState<RegistrationPage>({
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0 },
  });
  const [query, setQuery] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (requestedPage = 1, requestedQuery = query) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: 'PENDING',
        page: String(requestedPage),
        pageSize: '20',
      });
      if (requestedQuery.trim()) params.set('q', requestedQuery.trim());
      setPage(await apiClient.get<RegistrationPage>(`/registration-requests?${params}`));
      setQuery(requestedQuery);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load(1, '');
    // Initial pending page is loaded exactly once; later loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = useCallback(async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    await apiClient.patch(`/registration-requests/${requestId}`, { decision, expectedStatus: 'PENDING' });
    await load(page.pagination.page, query);
  }, [load, page.pagination.page, query]);

  const detail = useCallback((requestId: string) => (
    apiClient.get<RegistrationRequestDetail>(`/registration-requests/${requestId}`)
  ), []);

  return { ...page, isLoading, error, load, decide, detail };
}

export function messageFor(reason: unknown): string {
  if (reason instanceof ApiClientError) return reason.message;
  return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
}
