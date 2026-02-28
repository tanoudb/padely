import { Platform } from 'react-native';

const iosDisplay = 'AvenirNextCondensed-Heavy';
const iosTitle = 'AvenirNext-DemiBold';
const iosBody = 'AvenirNext-Regular';

export const theme = {
  colors: {
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
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 22,
  },
  fonts: {
    display: Platform.select({ ios: iosDisplay, android: 'sans-serif-condensed' }),
    title: Platform.select({ ios: iosTitle, android: 'sans-serif-medium' }),
    body: Platform.select({ ios: iosBody, android: 'sans-serif' }),
    mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
};
