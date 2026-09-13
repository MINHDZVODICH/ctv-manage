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

export interface AuthSessionUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface AuthSessionResponse {
  user: AuthSessionUserDto;
}
