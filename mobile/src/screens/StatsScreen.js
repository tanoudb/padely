import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function StatLine({ label, value, styles }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function StatsScreen() {
  const { token, user } = useSession();
  const { palette } = useUi();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.dashboard(token, user.id).then(setDashboard).catch(() => {});
  }, [token, user.id]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>STATISTIQUES</Text>
        <Text style={styles.h1}>Performance</Text>
      </View>

      <Card elevated>
        <Text style={styles.cardTitle}>Bilan global</Text>
        <StatLine label="Total victoires" value={dashboard?.wins ?? 0} styles={styles} />
        <StatLine label="Total defaites" value={dashboard?.losses ?? 0} styles={styles} />
        <StatLine label="Distance totale" value={`${dashboard?.totalDistanceKm ?? 0} km`} styles={styles} />
        <StatLine label="Distance moyenne" value={`${dashboard?.averageDistanceKm ?? 0} km/match`} styles={styles} />
        <StatLine label="Constance" value={`${dashboard?.consistencyScore ?? 0}/100`} styles={styles} />
        <StatLine label="Regularite" value={`${dashboard?.regularityScore ?? 0}/100`} styles={styles} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Charge de jeu</Text>
        <StatLine label="Temps total" value={`${dashboard?.playTimeMinutes ?? 0} min`} styles={styles} />
        <StatLine label="Calories estimees" value={dashboard?.calories ?? 0} styles={styles} />
        <StatLine label="Matchs joues" value={dashboard?.matches ?? 0} styles={styles} />
      </Card>
    </ScrollView>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, gap: 12, paddingBottom: 24 },
    header: { marginBottom: 4 },
    eyebrow: {
      color: palette.accent2,
      fontFamily: theme.fonts.mono,
      letterSpacing: 1,
      fontSize: 11,
    },
    h1: {
      color: palette.text,
      fontSize: 40,
      lineHeight: 42,
      fontFamily: theme.fonts.display,
    },
    cardTitle: {
      color: palette.text,
      fontFamily: theme.fonts.title,
      fontSize: 16,
      marginBottom: 10,
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    },
    label: {
      color: palette.muted,
      fontFamily: theme.fonts.body,
    },
    value: {
      color: palette.text,
      fontFamily: theme.fonts.title,
    },
  });
}
