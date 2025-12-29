import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSettings {
  autoRefresh: boolean;
  refreshInterval: number; // in seconds
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  autoRefresh: true,
  refreshInterval: 30,
  notificationsEnabled: false,
};

const STORAGE_KEY = 'signet_settings';

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(saved);
    return {
      autoRefresh: parsed.autoRefresh ?? DEFAULT_SETTINGS.autoRefresh,
      refreshInterval: parsed.refreshInterval ?? DEFAULT_SETTINGS.refreshInterval,
      notificationsEnabled: parsed.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
