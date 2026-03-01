import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function hashCode(input = '') {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function rankTier(rank = '') {
  const lower = String(rank).toLowerCase();
  if (lower.includes('or')) return 'gold';
  if (lower.includes('argent')) return 'silver';
  return 'bronze';
}

const SIZES = {
  sm: 32,
  md: 48,
  lg: 72,
};

export function Avatar({ name = '', size = 'md', rating = 1200, imageUrl = '' }) {
  const { mode } = useUi();
  const px = SIZES[size] ?? size ?? SIZES.md;
  const initials = useMemo(() => {
    const parts = String(name).trim().split(' ').filter(Boolean);
    if (!parts.length) return 'PL';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [name]);

  const hue = hashCode(name || initials) % 360;
  const bg = mode === 'day'
    ? `hsl(${hue} 50% 84%)`
    : `hsl(${hue} 45% 33%)`;
  const textColor = mode === 'day' ? '#0D1B2A' : '#F4FAFF';

  const tier = rankTier(rating >= 1500 ? 'or' : rating >= 1350 ? 'argent' : 'bronze');
  const borderColor = tier === 'gold' ? '#E8A800' : tier === 'silver' ? '#9DADB9' : '#8B6914';

  return (
    <View
      style={[
        styles.root,
        {
          width: px,
          height: px,
          borderRadius: px / 2,
          backgroundColor: bg,
          borderColor,
        },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: px - 2, height: px - 2, borderRadius: (px - 2) / 2 }}
        />
      ) : (
        <Text style={[styles.initials, { color: textColor, fontSize: Math.max(11, Math.round(px * 0.36)) }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: theme.fonts.title,
    letterSpacing: 0.4,
  },
});
