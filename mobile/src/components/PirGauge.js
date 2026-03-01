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
    <View style={styles.wrap}>
      <Svg width={220} height={220} viewBox="0 0 220 220">
        <Defs>
          <LinearGradient id="pirGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#E5544B" />
            <Stop offset="50%" stopColor="#E8A800" />
            <Stop offset="100%" stopColor="#00B89C" />
          </LinearGradient>
        </Defs>
        <Path
          d={arcPath(110, 110, 82, start, end)}
          stroke={palette.line}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(110, 110, 82, start, activeEnd)}
          stroke="url(#pirGradient)"
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        <Text style={[styles.value, { color: palette.text }]}>{Math.round(pir)}</Text>
        <Text style={[styles.rank, { color: palette.muted }]}>{rank}</Text>
        <Text style={[styles.delta, { color: deltaColor }]}>↗ {deltaLabel}</Text>
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
    top: 72,
  },
  value: {
    fontFamily: theme.fonts.display,
    fontSize: 48,
    lineHeight: 50,
  },
  rank: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  delta: {
    marginTop: 6,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
});
