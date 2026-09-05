export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
