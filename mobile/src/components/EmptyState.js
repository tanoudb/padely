import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function EmptyIcon({ variant, palette }) {
  if (variant === 'profile') {
    return (
      <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
        <Circle cx={36} cy={36} r={35} stroke={palette.lineStrong ?? palette.line} />
        <Circle cx={36} cy={28} r={12} stroke={palette.accent} strokeWidth={2} />
        <Path d="M18 58C21 48 28 44 36 44C44 44 51 48 54 58" stroke={palette.accent2} strokeWidth={2} />
      </Svg>
    );
  }
  if (variant === 'result') {
    return (
      <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
        <Rect x={7} y={10} width={58} height={52} rx={14} stroke={palette.lineStrong ?? palette.line} />
        <Rect x={17} y={24} width={38} height={10} rx={5} fill={palette.accentMuted} />
        <Path d="M18 44H54" stroke={palette.accent2} strokeWidth={2} />
        <Path d="M26 51H46" stroke={palette.accent} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
      <Rect x={8} y={10} width={56} height={52} rx={14} stroke={palette.lineStrong ?? palette.line} />
      <Path d="M18 28H54" stroke={palette.accent2} strokeWidth={2} />
      <Path d="M18 40H45" stroke={palette.accent} strokeWidth={2} />
      <Circle cx={52} cy={40} r={4} fill={palette.accentMuted} />
    </Svg>
  );
}

export function EmptyState({ title, body, variant = 'home', compact = false }) {
  const { palette } = useUi();
  return (
    <View style={[styles.wrap, compact && styles.compact, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}>
      <EmptyIcon variant={variant} palette={palette} />
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.body, { color: palette.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  compact: {
    paddingVertical: 12,
  },
  title: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
});
