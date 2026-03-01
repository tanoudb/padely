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
          backgroundColor: elevated ? (palette.bgElevated ?? palette.cardStrong) : palette.card,
          shadowColor: '#000',
          shadowOpacity: elevated ? (palette.key === 'night' ? 0.3 : 0.06) : 0,
          shadowRadius: elevated ? 20 : 0,
          shadowOffset: { width: 0, height: elevated ? 4 : 0 },
          elevation: elevated ? 4 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
  },
});
