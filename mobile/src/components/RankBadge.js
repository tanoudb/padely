import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme';

function rankColors(rank = '') {
  const value = String(rank).toLowerCase();
  if (value.includes('platin')) return { bg: '#0B5D65', text: '#E0FBFF', icon: '#8EF5FF' };
  if (value.includes('or')) return { bg: '#E8A800', text: '#3A2500', icon: '#FFF3B0' };
  if (value.includes('argent')) return { bg: '#7B8A96', text: '#F4F8FB', icon: '#DCE4EA' };
  return { bg: '#8B6914', text: '#FFF4DD', icon: '#EAC26E' };
}

export function RankBadge({ rank = 'Bronze I', size = 'md' }) {
  const isSmall = size === 'sm';
  const colors = rankColors(rank);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          minHeight: isSmall ? 24 : 30,
          paddingHorizontal: isSmall ? 8 : 10,
        },
      ]}
    >
      <Svg width={isSmall ? 12 : 14} height={isSmall ? 12 : 14} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L19 5V11C19 15.3 16.2 19.2 12 21C7.8 19.2 5 15.3 5 11V5L12 2Z" fill={colors.icon} />
      </Svg>
      <Text style={[styles.label, { color: colors.text, fontSize: isSmall ? 10 : 11 }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
