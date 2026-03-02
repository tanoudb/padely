import { Platform } from 'react-native';

const iosDisplay = 'DMSans-Bold';
const iosTitle = 'DMSans-Medium';
const iosBody = 'DMSans-Regular';

export const theme = {
  colors: {
    bg: '#F5F5F5',
    bgAlt: '#FFFFFF',
    bgElevated: '#EEF2FF',
    card: '#FFFFFF',
    cardStrong: '#EEF2FF',
    text: '#111827',
    textSecondary: '#4B5563',
    muted: '#9CA3AF',
    accent: '#2563EB',
    accent2: '#EAB308',
    danger: '#EF4444',
    warning: '#F59E0B',
    line: 'rgba(0,0,0,0.08)',
    chip: '#F0F4FF',
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
