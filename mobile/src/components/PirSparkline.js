import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useUi } from '../state/ui';

const WIDTH = 320;
const HEIGHT = 82;
const PAD = 6;

function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function PirSparkline({ data = [] }) {
  const { palette } = useUi();
  const series = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return Array.from({ length: 10 }).map((_, index) => ({
        x: index + 1,
        y: 1100 + index * 8,
      }));
    }
    return data.slice(-20).map((item, index) => ({
      x: index + 1,
      y: Number(item.value ?? item.pir ?? 0),
    }));
  }, [data]);

  const values = series.map((p) => p.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const domainPadding = Math.max(40, Math.round((max - min) * 0.4));
  const domainMin = min - domainPadding;
  const domainMax = max + domainPadding;
  const yRange = Math.max(1, domainMax - domainMin);

  const points = series.map((item, index) => {
    const x = PAD + (index / Math.max(1, series.length - 1)) * (WIDTH - PAD * 2);
    const yRatio = (item.y - domainMin) / yRange;
    const y = HEIGHT - PAD - yRatio * (HEIGHT - PAD * 2);
    return { x, y };
  });

  const linePath = pointsToPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? PAD} ${HEIGHT - PAD} L ${points[0]?.x ?? PAD} ${HEIGHT - PAD} Z`;

  return (
    <View style={styles.wrap}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="pirArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={palette.accent2} stopOpacity={0.42} />
            <Stop offset="100%" stopColor={palette.accent2} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#pirArea)" />
        <Path d={linePath} fill="none" stroke={palette.accent2} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    minHeight: 82,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
