import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ContrastOption, AccentColorOption, LanguageOption } from '../types';
import { translate } from '../i18n';

export interface SystemSettingsContextType {
  isDarkMode: boolean;
  contrast: ContrastOption;
  accentColor: AccentColorOption;
  language: LanguageOption;
  toggleDarkMode: () => void;
  setContrast: (contrast: ContrastOption) => void;
  setAccentColor: (color: AccentColorOption) => void;
  setLanguage: (lang: LanguageOption) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const STORAGE_KEY_DARK_MODE = 'ctv_sys_dark_mode';
const STORAGE_KEY_CONTRAST = 'ctv_sys_contrast';
const STORAGE_KEY_ACCENT = 'ctv_sys_accent';
const STORAGE_KEY_LANGUAGE = 'ctv_sys_language';

const accentMap: Record<
  AccentColorOption,
  { primary: string; hover: string; light: string; text: string }
> = {
  Xám: { primary: '#64748b', hover: '#475569', light: '#f1f5f9', text: '#ffffff' },
  Lục: { primary: '#10b981', hover: '#059669', light: '#ecfdf5', text: '#ffffff' },
  Lam: { primary: '#2563eb', hover: '#1d4ed8', light: '#eff6ff', text: '#ffffff' },
  Vàng: { primary: '#d97706', hover: '#b45309', light: '#fffbeb', text: '#ffffff' },
  Đỏ: { primary: '#dc2626', hover: '#b91c1c', light: '#fef2f2', text: '#ffffff' },
  Cam: { primary: '#ea580c', hover: '#c2410c', light: '#fff7ed', text: '#ffffff' },
  Tím: { primary: '#9333ea', hover: '#7e22ce', light: '#faf5ff', text: '#ffffff' },
};

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DARK_MODE);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [contrast, setContrastState] = useState<ContrastOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTRAST) as ContrastOption;
      return saved && ['Thấp', 'Trung bình', 'Cao'].includes(saved) ? saved : 'Trung bình';
    } catch {
      return 'Trung bình';
    }
  });

  const [accentColor, setAccentColorState] = useState<AccentColorOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACCENT) as string;
      if (saved === 'Trắng') return 'Xám';
      if (saved && saved in accentMap) return saved as AccentColorOption;
      return 'Lam';
    } catch {
      return 'Lam';
    }
  });

  const [language, setLanguageState] = useState<LanguageOption>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE) as LanguageOption;
      return saved && ['Tiếng Việt', 'Tiếng Anh'].includes(saved) ? saved : 'Tiếng Việt';
    } catch {
      return 'Tiếng Việt';
    }
  });

  // Apply dark mode class and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DARK_MODE, JSON.stringify(isDarkMode));
    } catch (e) {
      console.warn('[SystemSettingsContext] Failed to persist dark mode:', e);
    }
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Apply contrast attribute and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONTRAST, contrast);
    } catch (e) {
      console.warn('[SystemSettingsContext] Failed to persist contrast:', e);
    }
    const contrastVal = contrast === 'Cao' ? 'high' : contrast === 'Thấp' ? 'low' : 'medium';
    document.documentElement.setAttribute('data-contrast', contrastVal);
  }, [contrast]);

  // Apply accent color CSS variables and save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accentColor);
    } catch (e) {
      console.warn('[SystemSettingsContext] Failed to persist accent color:', e);
    }
    const config = accentMap[accentColor] || accentMap['Lam'];
    document.documentElement.style.setProperty('--accent-primary', config.primary);
    document.documentElement.style.setProperty('--accent-hover', config.hover);
    document.documentElement.style.setProperty('--accent-light', config.light);
    document.documentElement.style.setProperty('--accent-text', config.text);
    document.documentElement.style.setProperty('--accent-text-brand', config.primary);
  }, [accentColor, isDarkMode]);

  // Save language to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, language);
    } catch (e) {
      console.warn('[SystemSettingsContext] Failed to persist language:', e);
    }
  }, [language]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const setContrast = (c: ContrastOption) => setContrastState(c);
  const setAccentColor = (a: AccentColorOption) => setAccentColorState(a);
  const setLanguage = (l: LanguageOption) => setLanguageState(l);

  const t = (key: string, params?: Record<string, string | number>): string => {
    return translate(language, key, params);
  };

  return (
    <SystemSettingsContext.Provider
      value={{
        isDarkMode,
        contrast,
        accentColor,
        language,
        toggleDarkMode,
        setContrast,
        setAccentColor,
        setLanguage,
        t,
      }}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
};

const defaultContextValue: SystemSettingsContextType = {
  isDarkMode: false,
  contrast: 'Trung bình',
  accentColor: 'Lam',
  language: 'Tiếng Việt',
  toggleDarkMode: () => {},
  setContrast: () => {},
  setAccentColor: () => {},
  setLanguage: () => {},
  t: (key: string, params?: Record<string, string | number>) =>
    translate('Tiếng Việt', key, params),
};

export const useSystemSettings = (): SystemSettingsContextType => {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    return defaultContextValue;
  }
  return context;
};
