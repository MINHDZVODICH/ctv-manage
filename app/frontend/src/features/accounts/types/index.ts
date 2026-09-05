export type {
  UserAccount,
  RegistrationRequest,
  AccountStatus,
  RequestStatus,
  UserRole,
} from '../../../types';

export interface AccountFilters {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface RequestFilters {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}
