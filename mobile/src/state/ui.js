import React, { createContext, useContext, useMemo, useState } from 'react';

const PALETTES = {
  night: {
    key: 'night',
    label: 'Nuit',
    bg: '#06131C',
    bgAlt: '#0B2231',
    card: '#102B3C',
    cardStrong: '#163A50',
    text: '#F1F6FA',
    muted: '#9DB9CB',
    accent: '#F4D35E',
    accent2: '#00D1B2',
    danger: '#FF6B6B',
    warning: '#FFAD5A',
    line: '#295169',
    chip: '#0E2A3D',
  },
  day: {
    key: 'day',
    label: 'Jour',
    bg: '#0A1A26',
    bgAlt: '#143246',
    card: '#1A4058',
    cardStrong: '#22516D',
    text: '#F6FBFF',
    muted: '#B4CDDC',
    accent: '#FFD26A',
    accent2: '#24E2C6',
    danger: '#FF7272',
    warning: '#FFB56B',
    line: '#3B6480',
    chip: '#15364C',
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
