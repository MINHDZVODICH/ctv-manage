import { useState, useCallback, useRef } from 'react';
import type { RegistrationRequest, RequestFilters } from '../types';
import { registrationApi } from '../api/registrationApi';
import { requestsToRegistrationRequests } from '../../../shared/mappers';
import { isRequestAborted } from '../../../shared/api/client';

export interface UseRegistrationRequestsOptions {
  pageSize?: number;
  initialQuery?: string;
  initialStatus?: string;
}

export function useRegistrationRequests(options: UseRegistrationRequestsOptions = {}) {
  const pageSize = options.pageSize ?? 5;
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(options.initialQuery ?? '');
  const [status, setStatus] = useState(options.initialStatus ?? 'PENDING');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const loadRequests = useCallback(
    async (override?: { page?: number; q?: string; status?: string }) => {
      const targetPage = override?.page ?? page;
      const targetQ = override?.q !== undefined ? override.q : searchTerm;
      const targetStatus = override?.status !== undefined ? override.status : status;

      abortControllerRef.current?.abort();
      const ac = new AbortController();
      abortControllerRef.current = ac;
      const seq = ++requestSeqRef.current;

      setLoading(true);
      setError(null);

      try {
        const filters: RequestFilters = {
          page: targetPage,
          pageSize,
          q: targetQ.trim() || undefined,
          status: targetStatus,
        };
        const res: any = await registrationApi.listRequests(filters);
        if (seq !== requestSeqRef.current) return;

        const rows = res.data ?? [];
        const totalCount = res.total ?? rows.length;
        setRequests(requestsToRegistrationRequests(rows));
        setTotal(totalCount);
        setPage(targetPage);
      } catch (err: any) {
        if (isRequestAborted(err) || seq !== requestSeqRef.current) return;
        setError(err?.message || 'Không thể tải danh sách yêu cầu');
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [page, pageSize, searchTerm, status],
  );

  const approveRequest = useCallback(
    async (requestId: string) => {
      await registrationApi.decideRequest(requestId, 'APPROVED');
      await loadRequests();
    },
    [loadRequests],
  );

  const rejectRequest = useCallback(
    async (requestId: string, reason?: string) => {
      await registrationApi.decideRequest(requestId, 'REJECTED', reason);
      await loadRequests();
    },
    [loadRequests],
  );

  return {
    requests,
    setRequests,
    page,
    setPage,
    pageSize,
    status,
    setStatus,
    total,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    loadRequests,
    approveRequest,
    rejectRequest,
  };
}
