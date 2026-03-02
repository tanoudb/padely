import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function PirGauge({
  pir = 1200,
  delta = 0,
  rank = 'Bronze I',
  min = 800,
  max = 2000,
  size = 220,
  strokeWidth = 14,
}) {
  const { palette } = useUi();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  const normalized = useMemo(
    () => Math.max(0, Math.min(1, (pir - min) / (max - min))),
    [pir, min, max],
  );
  const sweep = 270;
  const start = 135;
  const end = start + sweep;
  const activeEnd = start + sweep * progress;
  const center = size / 2;
  const radius = Math.max(24, center - strokeWidth - 14);
  const centerTop = size * 0.34;
  const valueSize = Math.max(34, Math.round(size * 0.22));
  const rankSize = Math.max(10, Math.round(size * 0.055));
  const deltaSize = Math.max(11, Math.round(size * 0.06));

  useEffect(() => {
    const sub = progressAnim.addListener(({ value }) => setProgress(value));
    Animated.timing(progressAnim, {
      toValue: normalized,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      progressAnim.removeListener(sub);
    };
  }, [normalized, progressAnim]);

  const deltaColor = delta >= 0 ? palette.accent2 : palette.danger;
  const deltaLabel = `${delta >= 0 ? '+' : ''}${Math.round(delta)}`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="pirGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.danger} />
            <Stop offset="50%" stopColor={palette.accent} />
            <Stop offset="100%" stopColor={palette.accent2} />
          </LinearGradient>
        </Defs>
        <Path
          d={arcPath(center, center, radius, start, end)}
          stroke={palette.line}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(center, center, radius, start, activeEnd)}
          stroke="url(#pirGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <View style={[styles.centerContent, { top: centerTop }]} pointerEvents="none">
        <Text style={[styles.value, { color: palette.text, fontSize: valueSize, lineHeight: valueSize + 2 }]}>{Math.round(pir)}</Text>
        <Text style={[styles.rank, { color: palette.muted, fontSize: rankSize }]}>{rank}</Text>
        <Text style={[styles.delta, { color: deltaColor, fontSize: deltaSize }]}>↗ {deltaLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 220,
    height: 220,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: theme.fonts.display,
  },
  rank: {
    fontFamily: theme.fonts.title,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  delta: {
    marginTop: 6,
    fontFamily: theme.fonts.title,
  },
});
