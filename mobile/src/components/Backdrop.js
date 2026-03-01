import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useUi } from '../state/ui';

export function Backdrop() {
  const { palette, mode } = useUi();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={[styles.layer, { backgroundColor: mode === 'day' ? '#0E2332' : '#060F18' }]} />
      <Animated.View
        style={[
          styles.blob,
          styles.blobA,
          { backgroundColor: mode === 'day' ? 'rgba(255, 210, 106, 0.17)' : 'rgba(244, 211, 94, 0.14)' },
          {
            transform: [{
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.1],
              }),
            }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          styles.blobB,
          { backgroundColor: mode === 'day' ? 'rgba(36, 226, 198, 0.2)' : 'rgba(0, 209, 178, 0.16)' },
          {
            transform: [{
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1.08, 1],
              }),
            }],
          },
        ]}
      />
      <View style={[styles.blob, styles.blobC, { backgroundColor: `${palette.warning}22` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobA: {
    width: 340,
    height: 340,
    top: -120,
    left: -90,
  },
  blobB: {
    width: 300,
    height: 300,
    top: 160,
    right: -100,
  },
  blobC: {
    width: 360,
    height: 360,
    bottom: -120,
    left: 20,
  },
});
