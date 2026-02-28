import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

function rankFromRating(rating) {
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

export function HomeScreen() {
  const { token, user, logout } = useSession();
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.dashboard(token, user.id).then(setDashboard).catch(() => {});
  }, [token, user.id]);

  const rating = dashboard?.rating ?? user.rating ?? 1200;
  const pir = dashboard?.pir ?? user.pir ?? 50;
  const wins = dashboard?.wins ?? 0;
  const losses = dashboard?.losses ?? 0;
  const matches = dashboard?.matches ?? 0;

  const winRate = useMemo(() => {
    if (!matches) return 0;
    return Math.round((wins / matches) * 100);
  }, [wins, matches]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CENTRE PADELY</Text>
        <Text style={styles.h1}>Salut {user.displayName}</Text>
      </View>

      <Card elevated style={styles.hero}>
        <Text style={styles.heroLabel}>PIR EN DIRECT</Text>
        <Text style={styles.heroValue}>{Math.round(pir)}</Text>
        <Text style={styles.heroMeta}>Rang {rankFromRating(rating)} · Classement {Math.round(rating)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, pir))}%` }]} />
        </View>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Victoires</Text>
          <Text style={styles.metricValue}>{wins}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Defaites</Text>
          <Text style={styles.metricValue}>{losses}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Taux de victoire</Text>
          <Text style={styles.metricValue}>{winRate}%</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricLabel}>Matchs</Text>
          <Text style={styles.metricValue}>{matches}</Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Objectif du mois</Text>
        <Text style={styles.sectionText}>Atteindre Argent I: encore {Math.max(0, 1500 - Math.round(rating))} pts.</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Focus coaching</Text>
        <Text style={styles.sectionText}>Travail prioritaire: endurance en fin de set + routine punto de oro.</Text>
      </Card>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutLabel}>Quitter la session</Text>
      </Pressable>
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
  hero: {
    gap: 4,
  },
  heroLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  heroValue: {
    color: theme.colors.text,
    fontSize: 68,
    lineHeight: 70,
    fontFamily: theme.fonts.display,
  },
  heroMeta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    marginBottom: 8,
  },
  progressTrack: {
    height: 12,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#143246',
  },
  progressFill: {
    height: 12,
    backgroundColor: theme.colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    gap: 2,
  },
  metricLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  metricValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 28,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 16,
    marginBottom: 6,
  },
  sectionText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  logout: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 43, 60, 0.7)',
  },
  logoutLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
});
