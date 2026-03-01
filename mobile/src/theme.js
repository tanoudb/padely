import { Platform } from 'react-native';

const iosDisplay = 'DMSans-Bold';
const iosTitle = 'DMSans-Medium';
const iosBody = 'DMSans-Regular';

export const theme = {
  colors: {
    bg: '#09090B',
    bgAlt: '#18181B',
    bgElevated: '#27272A',
    card: '#18181B',
    cardStrong: '#27272A',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    muted: '#71717A',
    accent: '#D4A853',
    accent2: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    line: 'rgba(255, 255, 255, 0.06)',
    chip: '#232326',
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
