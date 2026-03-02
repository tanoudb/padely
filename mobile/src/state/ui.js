import React, { createContext, useContext, useMemo, useState } from 'react';

const PALETTES = {
  night: {
    key: 'night',
    label: 'Nuit',
    bg: '#09090B',
    bgAlt: '#18181B',
    bgElevated: '#27272A',
    card: '#18181B',
    cardStrong: '#27272A',
    cardGlass: 'rgba(39, 39, 42, 0.7)',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    muted: '#71717A',
    accent: '#D4A853',
    accentLight: '#E8C97A',
    accentDark: '#B8922F',
    accentMuted: 'rgba(212, 168, 83, 0.12)',
    accentText: '#09090B',
    accent2: '#10B981',
    accent2Muted: 'rgba(16, 185, 129, 0.12)',
    info: '#3B82F6',
    infoMuted: 'rgba(59, 130, 246, 0.14)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239, 68, 68, 0.12)',
    warning: '#F59E0B',
    line: 'rgba(255, 255, 255, 0.06)',
    lineMedium: 'rgba(255, 255, 255, 0.1)',
    lineStrong: 'rgba(255, 255, 255, 0.15)',
    glow: 'rgba(212, 168, 83, 0.25)',
    shadow: 'rgba(0, 0, 0, 0.5)',
    chip: '#232326',
  },
  day: {
    key: 'day',
    label: 'Jour',
    bg: '#FAFAFA',
    bgAlt: '#FFFFFF',
    bgElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardStrong: '#F4F4F5',
    cardGlass: 'rgba(255, 255, 255, 0.8)',
    text: '#0D1B2A',
    textSecondary: '#52525B',
    muted: '#A1A1AA',
    accent: '#B8922F',
    accentLight: '#D4A853',
    accentDark: '#967520',
    accentMuted: 'rgba(184, 146, 47, 0.08)',
    accentText: '#FFFFFF',
    accent2: '#059669',
    accent2Muted: 'rgba(5, 150, 105, 0.08)',
    info: '#2563EB',
    infoMuted: 'rgba(37, 99, 235, 0.1)',
    danger: '#DC2626',
    dangerMuted: 'rgba(220, 38, 38, 0.08)',
    warning: '#D97706',
    line: 'rgba(0, 0, 0, 0.06)',
    lineMedium: 'rgba(0, 0, 0, 0.1)',
    lineStrong: 'rgba(0, 0, 0, 0.15)',
    glow: 'rgba(184, 146, 47, 0.15)',
    shadow: 'rgba(0, 0, 0, 0.08)',
    chip: '#F4F4F5',
  },
};

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [mode, setMode] = useState('night');

  const value = useMemo(() => ({
    mode,
    palette: PALETTES[mode] ?? PALETTES.night,
    setMode(next) {
      if (next !== 'night' && next !== 'day') return;
      setMode(next);
    },
  }), [mode]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) {
    throw new Error('useUi must be used in UiProvider');
  }
  return value;
}
