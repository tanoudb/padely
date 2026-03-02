import { Platform } from 'react-native';

const iosDisplay = 'DMSans-Bold';
const iosTitle = 'DMSans-Medium';
const iosBody = 'DMSans-Regular';

export const theme = {
  colors: {
    bg: '#EDF4EF',
    bgAlt: '#FFFFFF',
    bgElevated: '#F6FBF8',
    card: '#FFFFFF',
    cardStrong: '#EDF5EF',
    text: '#13261D',
    textSecondary: '#3D5C4D',
    muted: '#708578',
    accent: '#C9843A',
    accent2: '#208A62',
    danger: '#D64545',
    warning: '#D47E2F',
    line: 'rgba(18, 38, 28, 0.12)',
    chip: '#EDF4EF',
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
    display: Platform.select({ ios: iosDisplay, android: 'DMSans-Bold' }),
    title: Platform.select({ ios: iosTitle, android: 'DMSans-Medium' }),
    body: Platform.select({ ios: iosBody, android: 'DMSans-Regular' }),
    mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
};
