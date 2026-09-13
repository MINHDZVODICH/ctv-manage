import { useState, useCallback, useRef, useEffect } from 'react';
import type { RegistrationRequest } from '../../../shared/types';
import { registrationApi } from '../api/registrationApi';
import { registrationRequestDtosToDomain } from '../mappers/registration-request.mapper';
import { isAbortError, normalizeErrorMessage } from '../../../shared/api/errors';

const DEFAULT_PAGE_SIZE = 5;

export interface PaginatedQueryState {
  page: number;
  pageSize: number;
  q: string;
  total: number;
  loading: boolean;
  error: string | null;
}

export interface UseRegistrationRequestsOptions {
  isAdmin: boolean;
  pageSize?: number;
  onToast?: (message: string) => void;
  t?: (key: string, params?: Record<string, string | number>) => string;
}

export interface UseRegistrationRequestsResult {
  requests: RegistrationRequest[];
  requestQuery: PaginatedQueryState;
  requestSearchInput: string;
  selectedRequest: RegistrationRequest | null;
  pendingRequestsCount: number;
  setRequestSearchInput: (term: string) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
  loadRequests: () => Promise<void>;
  openRequestDetail: (request: RegistrationRequest) => void;
  closeRequestDetail: () => void;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  setSelectedRequest: React.Dispatch<React.SetStateAction<RegistrationRequest | null>>;
  clearRequests: () => void;
}

export function useRegistrationRequests(
  options: UseRegistrationRequestsOptions,
): UseRegistrationRequestsResult {
  const { isAdmin, pageSize = DEFAULT_PAGE_SIZE, onToast, t } = options;

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (t) return t(key, params);
      return key;
    },
    [t],
  );

  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [requestQuery, setRequestQuery] = useState<PaginatedQueryState>({
    page: 1,
    pageSize,
    q: '',
    total: 0,
    loading: false,
    error: null,
  });
  const [requestSearchInput, setRequestSearchInput] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);

  const requestRequestController = useRef<AbortController | null>(null);
  const requestRequestSequence = useRef(0);
  const requestDetailSequence = useRef(0);

  // Debounce search input
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRequestQuery((current) => ({ ...current, q: requestSearchInput, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [requestSearchInput]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      requestRequestController.current?.abort();
      requestRequestSequence.current += 1;
      requestDetailSequence.current += 1;
    };
  }, []);

  const setPage = useCallback((page: number) => {
    setRequestQuery((current) => ({ ...current, page }));
  }, []);

  const resetFilters = useCallback(() => {
    setRequestSearchInput('');
    setRequestQuery((current) => ({ ...current, q: '', page: 1 }));
  }, []);

  const clearRequests = useCallback(() => {
    requestRequestController.current?.abort();
    requestRequestController.current = null;
    requestRequestSequence.current += 1;
    requestDetailSequence.current += 1;
    setRequests([]);
    setSelectedRequest(null);
  }, []);

  const { page: queryPage, pageSize: queryPageSize, q: queryQ } = requestQuery;

  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;
    requestRequestController.current?.abort();
    const controller = new AbortController();
    const sequence = ++requestRequestSequence.current;
    requestRequestController.current = controller;

    setRequestQuery((current) => ({ ...current, loading: true, error: null }));

    try {
      const res = await registrationApi.listRequests(
        {
          status: 'PENDING',
          page: queryPage,
          pageSize: queryPageSize,
          q: queryQ.trim() || undefined,
        },
        { signal: controller.signal },
      );
      if (sequence !== requestRequestSequence.current) return;

      const rows = res.items ?? [];
      const total = res.total ?? rows.length;
      const lastPage = Math.max(1, Math.ceil(total / queryPageSize));

      if (total > 0 && rows.length === 0 && queryPage > lastPage) {
        setRequestQuery((current) => ({ ...current, page: lastPage, total, loading: false }));
        return;
      }

      setRequests(registrationRequestDtosToDomain(rows));
      setRequestQuery((current) => ({ ...current, total, loading: false, error: null }));
    } catch (error) {
      if (isAbortError(error) || sequence !== requestRequestSequence.current) return;
      console.error('[useRegistrationRequests] Failed to load requests:', error);
      setRequestQuery((current) => ({
        ...current,
        loading: false,
        error: translate('app.requests_failed'),
      }));
    }
  }, [isAdmin, queryPage, queryPageSize, queryQ, translate]);

  const openRequestDetail = useCallback((req: RegistrationRequest) => {
    requestDetailSequence.current += 1;
    setSelectedRequest(req);
  }, []);

  const closeRequestDetail = useCallback(() => {
    requestDetailSequence.current += 1;
    setSelectedRequest(null);
  }, []);

  const approveRequest = useCallback(
    async (id: string) => {
      try {
        await registrationApi.decideRequest(id, 'APPROVED');
        if (onToast) {
          onToast(translate('app.req_approved_general'));
        }
        if (selectedRequest?.id === id) {
          closeRequestDetail();
        }
        await loadRequests();
      } catch (e: unknown) {
        console.error('[useRegistrationRequests] Failed to approve request:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.approve_failed')));
        }
      }
    },
    [closeRequestDetail, loadRequests, onToast, selectedRequest?.id, translate],
  );

  const rejectRequest = useCallback(
    async (id: string) => {
      try {
        await registrationApi.decideRequest(id, 'REJECTED');
        if (selectedRequest?.id === id) {
          closeRequestDetail();
        }
        if (onToast) {
          onToast(translate('app.req_rejected_general'));
        }
        await loadRequests();
      } catch (e: unknown) {
        console.error('[useRegistrationRequests] Failed to reject request:', e);
        if (onToast) {
          onToast(normalizeErrorMessage(e, translate('app.reject_failed')));
        }
      }
    },
    [closeRequestDetail, loadRequests, onToast, selectedRequest?.id, translate],
  );

  return {
    requests,
    requestQuery,
    requestSearchInput,
    selectedRequest,
    pendingRequestsCount: requestQuery.total,
    setRequestSearchInput,
    setPage,
    resetFilters,
    loadRequests,
    openRequestDetail,
    closeRequestDetail,
    approveRequest,
    rejectRequest,
    setSelectedRequest,
    clearRequests,
  };
}
