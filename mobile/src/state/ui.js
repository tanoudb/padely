import React, { createContext, useContext, useMemo, useState } from 'react';

export const PALETTES = {
  night: {
    key: 'night',
    label: 'Nuit',
    bg: '#111318',
    bgAlt: '#171B22',
    bgElevated: '#1E2430',
    card: '#1A1D24',
    cardStrong: '#222733',
    cardGlass: 'rgba(26, 29, 36, 0.82)',
    text: '#F5F7FB',
    textSecondary: '#B7C0D2',
    muted: '#8C96A9',
    accent: '#3B8DFF',
    accentLight: '#77B1FF',
    accentDark: '#1E6AD6',
    accentMuted: 'rgba(59, 141, 255, 0.18)',
    accentText: '#061224',
    accent2: '#2CE087',
    accent2Muted: 'rgba(44, 224, 135, 0.17)',
    info: '#42C8FF',
    infoMuted: 'rgba(66, 200, 255, 0.16)',
    danger: '#FF5A5F',
    dangerMuted: 'rgba(255, 90, 95, 0.16)',
    warning: '#FFB020',
    line: 'rgba(236, 243, 255, 0.12)',
    lineMedium: 'rgba(236, 243, 255, 0.2)',
    lineStrong: 'rgba(236, 243, 255, 0.3)',
    glow: 'rgba(59, 141, 255, 0.28)',
    shadow: 'rgba(0, 0, 0, 0.52)',
    chip: '#1F2430',
  },
  day: {
    key: 'day',
    label: 'Jour',
    bg: '#F3F4F6',
    bgAlt: '#FFFFFF',
    bgElevated: '#ECEFF4',
    card: '#FFFFFF',
    cardStrong: '#F8FAFD',
    cardGlass: 'rgba(255, 255, 255, 0.86)',
    text: '#0E1116',
    textSecondary: '#3B4556',
    muted: '#6A7486',
    accent: '#1570FF',
    accentLight: '#4E92FF',
    accentDark: '#0D56C4',
    accentMuted: 'rgba(21, 112, 255, 0.14)',
    accentText: '#FFFFFF',
    accent2: '#1FBA63',
    accent2Muted: 'rgba(31, 186, 99, 0.12)',
    info: '#00A3FF',
    infoMuted: 'rgba(0, 163, 255, 0.12)',
    danger: '#F04438',
    dangerMuted: 'rgba(240, 68, 56, 0.1)',
    warning: '#FF9F1A',
    line: 'rgba(14, 17, 22, 0.12)',
    lineMedium: 'rgba(14, 17, 22, 0.18)',
    lineStrong: 'rgba(14, 17, 22, 0.24)',
    glow: 'rgba(21, 112, 255, 0.2)',
    shadow: 'rgba(11, 22, 34, 0.16)',
    chip: '#EEF3FF',
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
