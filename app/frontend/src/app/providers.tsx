import React from 'react';
import { AuthProvider } from '../shared/auth/AuthContext';
import { SystemSettingsProvider } from '../context/SystemSettingsContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <SystemSettingsProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SystemSettingsProvider>
  );
};

export default AppProviders;
