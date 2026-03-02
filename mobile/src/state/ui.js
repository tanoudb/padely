import React, { createContext, useContext, useMemo, useState } from 'react';

export const PALETTES = {
  night: {
    key: 'night',
    label: 'Nuit',
    bg: '#0F1115',
    bgAlt: '#1A1D24',
    bgElevated: '#20242D',
    card: '#1A1D24',
    cardStrong: '#22252E',
    cardGlass: 'rgba(26, 29, 36, 0.84)',
    text: '#F3F4F6',
    textSecondary: '#CDD3DE',
    muted: '#9CA3AF',
    accent: '#3B82F6',
    accentLight: '#60A5FA',
    accentDark: '#2563EB',
    accentMuted: 'rgba(59,130,246,0.18)',
    accentText: '#FFFFFF',
    accent2: '#FACC15',
    accent2Muted: 'rgba(250,204,21,0.2)',
    info: '#0EA5E9',
    infoMuted: 'rgba(14,165,233,0.16)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239,68,68,0.17)',
    warning: '#F59E0B',
    line: 'rgba(243,244,246,0.12)',
    lineMedium: 'rgba(243,244,246,0.2)',
    lineStrong: 'rgba(243,244,246,0.3)',
    glow: 'rgba(59,130,246,0.25)',
    shadow: 'rgba(0,0,0,0.55)',
    chip: '#22252E',
    tierBronze: '#CD7F32',
    tierSilver: '#C0C0C0',
    tierGold: '#FFD700',
    tierMythic: '#9B59B6',
  },
  day: {
    key: 'day',
    label: 'Jour',
    bg: '#F5F5F5',
    bgAlt: '#FFFFFF',
    bgElevated: '#EEF2FF',
    card: '#FFFFFF',
    cardStrong: '#EEF2FF',
    cardGlass: 'rgba(255, 255, 255, 0.86)',
    text: '#111827',
    textSecondary: '#4B5563',
    muted: '#9CA3AF',
    accent: '#2563EB',
    accentLight: '#3B82F6',
    accentDark: '#1D4ED8',
    accentMuted: 'rgba(37,99,235,0.1)',
    accentText: '#FFFFFF',
    accent2: '#EAB308',
    accent2Muted: 'rgba(234,179,8,0.12)',
    info: '#0EA5E9',
    infoMuted: 'rgba(14,165,233,0.12)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239,68,68,0.1)',
    warning: '#F59E0B',
    line: 'rgba(0,0,0,0.08)',
    lineMedium: 'rgba(0,0,0,0.12)',
    lineStrong: 'rgba(0,0,0,0.18)',
    glow: 'rgba(37,99,235,0.15)',
    shadow: 'rgba(17,24,39,0.14)',
    chip: '#F0F4FF',
    tierBronze: '#CD7F32',
    tierSilver: '#C0C0C0',
    tierGold: '#FFD700',
    tierMythic: '#9B59B6',
  },
};

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [mode, setMode] = useState('day');

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
