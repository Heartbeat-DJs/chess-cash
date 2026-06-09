/* ===================================================================
   ChessCash — Settings Context
   Player customization persisted to localStorage, SSR-safe.
   =================================================================== */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PlayerCustomization } from '@/types';
import { DEFAULT_CUSTOMIZATION } from '@/types';
import { configureSound } from '@/lib/sounds';

const STORAGE_KEY = 'chesscash.settings.v1';

interface SettingsContextValue {
  settings: PlayerCustomization;
  updateSettings: (patch: Partial<PlayerCustomization>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_CUSTOMIZATION,
  updateSettings: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PlayerCustomization>(DEFAULT_CUSTOMIZATION);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  // localStorage is an external system, so a one-time post-mount sync
  // is the intended pattern here despite the cascading-render lint rule.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings({ ...DEFAULT_CUSTOMIZATION, ...(JSON.parse(raw) as Partial<PlayerCustomization>) });
      }
    } catch {
      // corrupted storage — keep defaults
    }
  }, []);

  useEffect(() => {
    configureSound({ enabled: settings.enableSounds, volume: settings.soundVolume });
  }, [settings.enableSounds, settings.soundVolume]);

  const updateSettings = useCallback((patch: Partial<PlayerCustomization>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // best-effort persistence
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_CUSTOMIZATION);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
