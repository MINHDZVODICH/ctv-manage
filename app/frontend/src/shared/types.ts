import type { UserRole } from './api/contracts';

export type AppView = 'accounts' | 'requests' | 'my-schedule' | 'summary-schedule' | 'profile';

export interface NavigationItem {
  id: AppView;
  icon: string;
  label: string;
  roles: UserRole[];
}
