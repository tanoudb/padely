import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useUi } from '../state/ui';

export function Card({ children, style, elevated = false }) {
  const { palette } = useUi();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? palette.cardStrong : palette.card,
          borderColor: palette.line,
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
