import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function signed(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '+0.0';
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}`;
}

export function MatchShareCard({
  matchId,
  scoreLine,
  teamALabel,
  teamBLabel,
  pirDelta = 0,
  badgeTitle = '',
}) {
  const { palette } = useUi();

  return (
    <View style={[styles.canvas, { backgroundColor: palette.bg }]}>
      <View style={[styles.glowTop, { backgroundColor: palette.accentMuted }]} />
      <View style={[styles.glowBottom, { backgroundColor: palette.accent2Muted }]} />

      <View style={[styles.card, { backgroundColor: palette.cardStrong, borderColor: palette.lineStrong }]}>
        <Text style={[styles.brand, { color: palette.accent }]}>PADELY</Text>
        <Text style={[styles.kicker, { color: palette.textSecondary }]}>MATCH RESULT</Text>

        <View style={[styles.scoreWrap, { borderColor: palette.line, backgroundColor: palette.card }]}>
          <Text style={[styles.score, { color: palette.text }]}>{scoreLine || '- -'}</Text>
        </View>

        <View style={styles.teams}>
          <View style={[styles.teamBox, { borderColor: palette.line, backgroundColor: palette.card }]}>
            <Text style={[styles.teamLabel, { color: palette.textSecondary }]}>TEAM A</Text>
            <Text style={[styles.teamName, { color: palette.text }]} numberOfLines={2}>{teamALabel || 'Padely Team'}</Text>
          </View>
          <View style={[styles.teamBox, { borderColor: palette.line, backgroundColor: palette.card }]}>
            <Text style={[styles.teamLabel, { color: palette.textSecondary }]}>TEAM B</Text>
            <Text style={[styles.teamName, { color: palette.text }]} numberOfLines={2}>{teamBLabel || 'Padely Team'}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <View style={[styles.metricCard, { borderColor: palette.line, backgroundColor: palette.card }]}>
            <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>PIR DELTA</Text>
            <Text style={[styles.metricValue, { color: Number(pirDelta) >= 0 ? palette.accent2 : palette.danger }]}>{signed(pirDelta)}</Text>
          </View>
          <View style={[styles.metricCard, { borderColor: palette.line, backgroundColor: palette.card }]}>
            <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>BADGE</Text>
            <Text style={[styles.metricBadge, { color: badgeTitle ? palette.accent : palette.muted }]} numberOfLines={2}>
              {badgeTitle || 'No unlock this match'}
            </Text>
          </View>
        </View>

        <Text style={[styles.meta, { color: palette.muted }]}>Match #{String(matchId ?? '').slice(-6) || '------'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: 1080,
    height: 1350,
    padding: 60,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    right: -140,
    width: 420,
    height: 420,
    borderRadius: 210,
  },
  glowBottom: {
    position: 'absolute',
    left: -120,
    bottom: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  card: {
    borderWidth: 1,
    borderRadius: 36,
    paddingHorizontal: 54,
    paddingVertical: 56,
    gap: 24,
  },
  brand: {
    fontFamily: theme.fonts.display,
    fontSize: 78,
    letterSpacing: 10,
    textAlign: 'center',
  },
  kicker: {
    fontFamily: theme.fonts.title,
    fontSize: 26,
    letterSpacing: 3.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  scoreWrap: {
    borderWidth: 1,
    borderRadius: 26,
    minHeight: 170,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  score: {
    fontFamily: theme.fonts.mono,
    fontSize: 86,
    letterSpacing: 3.8,
    textAlign: 'center',
  },
  teams: {
    flexDirection: 'row',
    gap: 16,
  },
  teamBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 134,
    gap: 8,
  },
  teamLabel: {
    fontFamily: theme.fonts.title,
    fontSize: 19,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  teamName: {
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 38,
  },
  metrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    minHeight: 132,
    justifyContent: 'center',
    gap: 8,
  },
  metricLabel: {
    fontFamily: theme.fonts.title,
    fontSize: 19,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: theme.fonts.display,
    fontSize: 58,
    lineHeight: 60,
  },
  metricBadge: {
    fontFamily: theme.fonts.title,
    fontSize: 30,
    lineHeight: 34,
  },
  meta: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
    fontSize: 20,
    letterSpacing: 0.8,
  },
});
