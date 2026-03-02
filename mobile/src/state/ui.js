import React, { createContext, useContext, useMemo, useState } from 'react';

const PALETTES = {
  night: {
    key: 'night',
    label: 'Nuit',
    bg: '#07150F',
    bgAlt: '#0C2118',
    bgElevated: '#123126',
    card: '#0F2A1F',
    cardStrong: '#143628',
    cardGlass: 'rgba(20, 54, 40, 0.7)',
    text: '#ECF7F1',
    textSecondary: '#B3CEC0',
    muted: '#84A798',
    accent: '#D08A3A',
    accentLight: '#E0A45D',
    accentDark: '#B4732D',
    accentMuted: 'rgba(208, 138, 58, 0.14)',
    accentText: '#1D1308',
    accent2: '#2CB67D',
    accent2Muted: 'rgba(44, 182, 125, 0.14)',
    info: '#66A3D2',
    infoMuted: 'rgba(102, 163, 210, 0.16)',
    danger: '#EF5C5C',
    dangerMuted: 'rgba(239, 92, 92, 0.14)',
    warning: '#E6A24A',
    line: 'rgba(209, 234, 221, 0.12)',
    lineMedium: 'rgba(209, 234, 221, 0.18)',
    lineStrong: 'rgba(209, 234, 221, 0.24)',
    glow: 'rgba(208, 138, 58, 0.24)',
    shadow: 'rgba(0, 0, 0, 0.45)',
    chip: '#173A2D',
  },
  day: {
    key: 'day',
    label: 'Jour',
    bg: '#EDF4EF',
    bgAlt: '#FFFFFF',
    bgElevated: '#F6FBF8',
    card: '#FFFFFF',
    cardStrong: '#EDF5EF',
    cardGlass: 'rgba(255, 255, 255, 0.8)',
    text: '#13261D',
    textSecondary: '#3D5C4D',
    muted: '#708578',
    accent: '#C9843A',
    accentLight: '#DEA260',
    accentDark: '#AA6E2C',
    accentMuted: 'rgba(201, 132, 58, 0.12)',
    accentText: '#FFFFFF',
    accent2: '#208A62',
    accent2Muted: 'rgba(32, 138, 98, 0.12)',
    info: '#2E6EA7',
    infoMuted: 'rgba(46, 110, 167, 0.12)',
    danger: '#D64545',
    dangerMuted: 'rgba(214, 69, 69, 0.1)',
    warning: '#D47E2F',
    line: 'rgba(18, 38, 28, 0.12)',
    lineMedium: 'rgba(18, 38, 28, 0.17)',
    lineStrong: 'rgba(18, 38, 28, 0.23)',
    glow: 'rgba(201, 132, 58, 0.15)',
    shadow: 'rgba(16, 31, 22, 0.12)',
    chip: '#EDF4EF',
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
