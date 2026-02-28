import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { RadarDNA } from '../components/RadarDNA';
import { useSession } from '../state/session';
import { theme } from '../theme';

function buildPillars(dashboard, duos) {
  const power = Math.min(100, 35 + (dashboard?.pir ?? 45));
  const stamina = Math.min(100, 20 + (dashboard?.distanceKm ?? 0) * 8);
  const consistency = Math.min(100, 30 + (dashboard?.wins ?? 0) * 7);
  const clutch = Math.min(100, 40 + ((dashboard?.matches ?? 0) - (dashboard?.losses ?? 0)) * 5);
  const social = Math.min(100, 50 + (duos?.length ?? 0) * 6);

  return {
    power,
    stamina,
    consistency,
    clutch,
    social,
  };
}

export function StatsScreen() {
  const { token, user } = useSession();
  const [dashboard, setDashboard] = useState(null);
  const [duos, setDuos] = useState([]);
  const [holes, setHoles] = useState([]);
  const [bag, setBag] = useState([]);

  useEffect(() => {
    Promise.all([
      api.dashboard(token, user.id),
      api.duoStats(token, user.id),
      api.holes(token, user.id),
      api.bag(token),
    ]).then(([d, duo, h, b]) => {
      setDashboard(d);
      setDuos(duo);
      setHoles(h.findings ?? []);
      setBag(b);
    }).catch(() => {});
  }, [token, user.id]);

  const pillars = useMemo(() => buildPillars(dashboard, duos), [dashboard, duos]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PERFORMANCE LAB</Text>
        <Text style={styles.h1}>PIR DNA</Text>
      </View>

      <Card elevated>
        <Text style={styles.sectionTitle}>Radar de style</Text>
        <RadarDNA pillars={pillars} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Dashboard match</Text>
        <View style={styles.statRow}><Text style={styles.k}>Temps de jeu</Text><Text style={styles.v}>{dashboard?.playTimeMinutes ?? 0} min</Text></View>
        <View style={styles.statRow}><Text style={styles.k}>Calories</Text><Text style={styles.v}>{dashboard?.calories ?? 0}</Text></View>
        <View style={styles.statRow}><Text style={styles.k}>Distance</Text><Text style={styles.v}>{dashboard?.distanceKm ?? 0} km</Text></View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Statistiques de binome</Text>
        {duos.length === 0 ? <Text style={styles.row}>Aucune donnee</Text> : duos.map((item) => (
          <View key={item.partnerId} style={styles.statRow}>
            <Text style={styles.k}>Partenaire {item.partnerId.slice(-4)}</Text>
            <Text style={styles.v}>{item.winRate}% · {item.matches}m</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Performance holes</Text>
        {holes.length === 0 ? <Text style={styles.row}>Pas encore assez de matchs</Text> : holes.map((line, i) => (
          <Text key={String(i)} style={styles.row}>{line}</Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Sac de padel</Text>
        {bag.length === 0 ? <Text style={styles.row}>Aucun materiel</Text> : bag.map((item) => (
          <View key={item.id} style={styles.bagItem}>
            <View style={styles.statRow}>
              <Text style={styles.k}>{item.brand} {item.model}</Text>
              <Text style={styles.v}>{item.wearPercent}%</Text>
            </View>
            <View style={styles.wearTrack}>
              <View style={[styles.wearFill, { width: `${Math.max(4, Math.min(100, item.wearPercent ?? 0))}%` }]} />
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  eyebrow: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    letterSpacing: 1,
    fontSize: 11,
  },
  h1: {
    color: theme.colors.text,
    fontSize: 40,
    lineHeight: 42,
    fontFamily: theme.fonts.display,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 16,
    marginBottom: 10,
  },
  row: { color: theme.colors.muted, marginBottom: 5, fontFamily: theme.fonts.body },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    paddingVertical: 6,
  },
  k: { color: theme.colors.muted, fontFamily: theme.fonts.body },
  v: { color: theme.colors.text, fontFamily: theme.fonts.title },
  bagItem: { marginBottom: 10 },
  wearTrack: {
    marginTop: 6,
    height: 9,
    borderRadius: 99,
    backgroundColor: '#17374B',
    overflow: 'hidden',
  },
  wearFill: {
    height: 9,
    backgroundColor: theme.colors.warning,
  },
});
