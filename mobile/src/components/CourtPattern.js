import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useUi } from '../state/ui';

function toRgba(hex, alpha) {
  const value = String(hex ?? '').replace('#', '').trim();
  if (value.length !== 6) {
    return `rgba(0,0,0,${alpha})`;
  }
  const parsed = Number.parseInt(value, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function CourtPattern({ variant = 'home' }) {
  const { mode, palette } = useUi();

  const lineColor = toRgba(palette.accent, mode === 'day' ? 0.16 : 0.2);
  const turfColor = toRgba(palette.accent, mode === 'day' ? 0.05 : 0.08);
  const clayColor = toRgba(palette.accentDark, mode === 'day' ? 0.08 : 0.11);
  const ballColor = toRgba(palette.accent2, mode === 'day' ? 0.18 : 0.24);

  const topAccent = variant === 'community';
  const circleX = topAccent ? 12 : 88;
  const circleY = topAccent ? 18 : 14;
  const circleR = topAccent ? 24 : 22;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Rect x="0" y="0" width="100" height="100" fill={palette.bg} />

        <Circle cx={circleX} cy={circleY} r={circleR} fill={clayColor} />
        <Circle cx={topAccent ? 84 : 18} cy={topAccent ? 88 : 84} r={18} fill={turfColor} />

        <Path
          d="M 10 18 H 90 Q 94 18 94 22 V 78 Q 94 82 90 82 H 10 Q 6 82 6 78 V 22 Q 6 18 10 18 Z"
          stroke={lineColor}
          strokeWidth={0.6}
          fill="none"
        />
        <Path d="M 50 18 V 82" stroke={lineColor} strokeWidth={0.45} />
        <Path d="M 6 50 H 94" stroke={lineColor} strokeWidth={0.45} />
        <Path d="M 25 18 V 82" stroke={lineColor} strokeWidth={0.25} />
        <Path d="M 75 18 V 82" stroke={lineColor} strokeWidth={0.25} />

        <Circle cx={topAccent ? 90 : 14} cy={topAccent ? 12 : 88} r={4.5} fill={ballColor} />
        <Path d={topAccent ? 'M 83 8 L 97 16' : 'M 9 83 L 23 92'} stroke={lineColor} strokeWidth={0.32} />
      </Svg>
    </View>
  );
}
