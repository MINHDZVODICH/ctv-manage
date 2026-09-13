export interface RegistrationFileDto {
  category: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RegistrationRequestDto {
  id: string;
  email: string;
  displayName: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  status: string;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  approvedAccountId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  files?: RegistrationFileDto[];
}

export interface RequestFilters {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface RegistrationListResponse {
  items: RegistrationRequestDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RegistrationDecisionResponse {
  request: RegistrationRequestDto;
  approvedAccount?: {
    id: string;
    email: string;
    ctvCode: string;
  };
}

export interface SubmitRegistrationResponse {
  request: RegistrationRequestDto;
}
