import { Platform } from 'react-native';

const iosDisplay = 'DMSans-Bold';
const iosTitle = 'DMSans-Medium';
const iosBody = 'DMSans-Regular';

export const theme = {
  colors: {
    bg: '#F3F4F6',
    bgAlt: '#FFFFFF',
    bgElevated: '#ECEFF4',
    card: '#FFFFFF',
    cardStrong: '#F8FAFD',
    text: '#0E1116',
    textSecondary: '#3B4556',
    muted: '#6A7486',
    accent: '#1570FF',
    accent2: '#1FBA63',
    danger: '#F04438',
    warning: '#FF9F1A',
    line: 'rgba(14, 17, 22, 0.12)',
    chip: '#EEF3FF',
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
