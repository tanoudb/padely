import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUi } from '../state/ui';
import { theme } from '../theme';

export function StatPill({ value, label, highlight = false }) {
  const { palette } = useUi();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: highlight ? palette.cardStrong : palette.card,
          borderColor: palette.line,
        },
      ]}
    >
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontFamily: theme.fonts.title,
    fontSize: 28,
    lineHeight: 30,
  },
  label: {
    marginTop: 4,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
