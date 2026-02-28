import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';

export function Backdrop() {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      <View style={[styles.blob, styles.blobC]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobA: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(244, 211, 94, 0.10)',
    top: -80,
    left: -60,
  },
  blobB: {
    width: 240,
    height: 240,
    backgroundColor: 'rgba(0, 209, 178, 0.13)',
    top: 180,
    right: -90,
  },
  blobC: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(255, 173, 90, 0.08)',
    bottom: -120,
    left: 40,
  },
});
