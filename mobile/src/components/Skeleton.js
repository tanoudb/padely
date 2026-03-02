import React from 'react';
import { StyleSheet } from 'react-native';
import { useUi } from '../state/ui';
import { AnimatedView, usePulseLoop } from '../hooks/usePadelyAnimations';

export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const { palette } = useUi();
  const pulseStyle = usePulseLoop();

  return (
    <AnimatedView
      style={[
        styles.base,
        pulseStyle,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: palette.key === 'night' ? palette.bgElevated : palette.cardStrong,
          borderColor: palette.line,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
