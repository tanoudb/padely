import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const AXES = [
  { key: 'power', label: 'Power' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'clutch', label: 'Clutch' },
  { key: 'social', label: 'Fair-play' },
];

function axisPoint(index, radius, center) {
  const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / AXES.length;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function edgeStyle(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    width: length,
    left: from.x,
    top: from.y,
    transform: [{ rotate: `${angle}rad` }],
  };
}

export function RadarDNA({ pillars }) {
  const size = 220;
  const center = size / 2;
  const maxRadius = 76;

  const basePoints = AXES.map((_, i) => axisPoint(i, maxRadius, center));
  const values = AXES.map((axis) => Number(pillars?.[axis.key] ?? 40));
  const valuePoints = values.map((value, i) => axisPoint(i, (maxRadius * Math.max(0, Math.min(100, value))) / 100, center));

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chart, { width: size, height: size }]}>
        <View style={[styles.ring, { width: maxRadius * 2, height: maxRadius * 2, left: center - maxRadius, top: center - maxRadius }]} />
        <View style={[styles.ring, { width: maxRadius * 1.4, height: maxRadius * 1.4, left: center - maxRadius * 0.7, top: center - maxRadius * 0.7 }]} />

        {basePoints.map((point, i) => {
          const axis = edgeStyle({ x: center, y: center }, point);
          return <View key={`axis-${AXES[i].key}`} style={[styles.axis, axis]} />;
        })}

        {valuePoints.map((point, i) => {
          const next = valuePoints[(i + 1) % valuePoints.length];
          return <View key={`edge-${AXES[i].key}`} style={[styles.edge, edgeStyle(point, next)]} />;
        })}

        {valuePoints.map((point, i) => (
          <View key={`dot-${AXES[i].key}`} style={[styles.dot, { left: point.x - 4, top: point.y - 4 }]} />
        ))}

        <View style={[styles.center, { left: center - 6, top: center - 6 }]} />
      </View>

      <View style={styles.legend}>
        {AXES.map((axis) => (
          <View key={axis.key} style={styles.legendRow}>
            <Text style={styles.legendKey}>{axis.label}</Text>
            <Text style={styles.legendVal}>{Math.round(values[AXES.findIndex((a) => a.key === axis.key)])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 999,
    backgroundColor: 'rgba(6, 19, 28, 0.45)',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(157, 185, 203, 0.18)',
  },
  axis: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(157, 185, 203, 0.2)',
  },
  edge: {
    position: 'absolute',
    height: 2,
    backgroundColor: theme.colors.accent,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: theme.colors.accent2,
  },
  center: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 99,
    backgroundColor: theme.colors.warning,
  },
  legend: {
    flex: 1,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.1)',
    paddingBottom: 4,
  },
  legendKey: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  legendVal: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
  },
});
