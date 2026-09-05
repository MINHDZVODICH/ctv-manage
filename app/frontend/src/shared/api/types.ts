export interface ApiResponse<T> {
  data?: T;
  user?: T;
  request?: T;
  file?: T;
  status?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
