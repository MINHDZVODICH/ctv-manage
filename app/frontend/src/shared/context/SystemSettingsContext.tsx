import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

interface SystemSettings {
  systemName: string;
  isDarkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
}

const defaultSettings: SystemSettings = {
  systemName: 'Hệ thống Quản lý CTV',
  isDarkMode: false,
  setDarkMode: () => undefined,
};

const SystemSettingsContext = createContext<SystemSettings>(defaultSettings);

export function SystemSettingsProvider({ children }: PropsWithChildren) {
  const [isDarkMode, setDarkMode] = useState(false);
  const value = useMemo(() => ({
    ...defaultSettings,
    isDarkMode,
    setDarkMode,
  }), [isDarkMode]);

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}

export function useSystemSettings(): SystemSettings {
  return useContext(SystemSettingsContext);
}
