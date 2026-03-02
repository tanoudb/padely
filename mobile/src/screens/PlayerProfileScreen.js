import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const PERIODS = ['week', 'month', 'season', 'all'];

function periodLabel(period) {
  if (period === 'week') return '7j';
  if (period === 'month') return '30j';
  if (period === 'season') return 'Saison';
  return 'Tout';
}

function Heatmap({ items, palette }) {
  const weeks = useMemo(() => {
    const buckets = [];
    const safe = Array.isArray(items) ? items : [];
    safe.forEach((item, index) => {
      const week = Math.floor(index / 7);
      if (!buckets[week]) {
        buckets[week] = [];
      }
      buckets[week].push(item);
    });
    return buckets;
  }, [items]);

  function colorForLevel(level) {
    if (!level) return palette.accentMuted;
    if (level === 1) return palette.accentMuted;
    if (level === 2) return palette.accent;
    if (level === 3) return palette.accent2;
    return palette.accentLight ?? palette.accent;
  }

  return (
    <View style={styles.heatmapWrap}>
      {weeks.map((week, weekIndex) => (
        <View key={`w_${weekIndex}`} style={styles.heatmapCol}>
          {week.map((item) => (
            <View
              key={item.day}
              style={[
                styles.heatCell,
                {
                  backgroundColor: colorForLevel(item.intensity),
                  borderColor: palette.line,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function StatTile({ label, value, palette }) {
  return (
    <View style={[styles.statTile, { backgroundColor: palette.card, borderColor: palette.line }]}>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ScoreLine({ label, value, palette }) {
  return (
    <View style={[styles.line, { borderBottomColor: palette.line }]}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function badgeLabel(name) {
  return String(name ?? '').toUpperCase();
}

export function PlayerProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { token, user } = useSession();
  const { palette } = useUi();
  const playerId = String(route.params?.playerId ?? '');

  const [period, setPeriod] = useState('season');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState(null);

  async function load() {
    if (!playerId) {
      setError('Profil joueur introuvable.');
      setLoading(false);
      return;
    }

    setError('');
    const out = await api.publicProfile(token, playerId, period);
    setProfileData(out);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
      .catch((e) => {
        if (!active) return;
        setError(e.message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, playerId, period]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  function proposeMatch() {
    navigation.getParent()?.navigate('PlayTab', {
      screen: 'PlaySetup',
      params: { suggestedPlayerId: playerId },
    });
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
        <Card>
          <Text style={[styles.errorTitle, { color: palette.text }]}>Profil indisponible</Text>
          <Text style={[styles.errorText, { color: palette.textSecondary }]}>{error}</Text>
        </Card>
      </ScrollView>
    );
  }

  const profile = profileData?.profile ?? {};
  const stats = profileData?.stats ?? {};
  const records = profileData?.records ?? {};
  const head = profileData?.headToHead;
  const recentMatches = profileData?.recentMatches ?? [];
  const badges = profileData?.badges ?? [];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>PROFIL JOUEUR</Text>
        <Text style={[styles.h1, { color: palette.text }]}>{profile.displayName ?? route.params?.playerName ?? 'Joueur'}</Text>
        <Text style={[styles.sub, { color: palette.textSecondary }]}>PIR {Math.round(profile.pir ?? 0)} · Classement {Math.round(profile.rating ?? 0)} · {profile.city ?? 'France'}</Text>
        {playerId !== user.id ? (
          <Pressable style={[styles.cta, { backgroundColor: palette.accent }]} onPress={proposeMatch}>
            <Text style={[styles.ctaText, { color: palette.accentText ?? '#09090B' }]}>PROPOSER UN MATCH</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((key) => {
          const active = key === period;
          return (
            <Pressable
              key={key}
              style={[
                styles.periodBtn,
                {
                  borderColor: active ? palette.accent : palette.line,
                  backgroundColor: active ? palette.accentMuted : palette.card,
                },
              ]}
              onPress={() => setPeriod(key)}
            >
              <Text style={[styles.periodText, { color: active ? palette.accent : palette.textSecondary }]}>{periodLabel(key)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsGrid}>
        <StatTile label="Matchs" value={stats.matches ?? 0} palette={palette} />
        <StatTile label="Winrate" value={`${stats.winRate ?? 0}%`} palette={palette} />
        <StatTile label="Regularite" value={stats.regularityScore ?? 0} palette={palette} />
        <StatTile label="Constance" value={stats.consistencyScore ?? 0} palette={palette} />
      </View>

      {head ? (
        <Card elevated>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Face-a-face</Text>
          <ScoreLine label="Confrontations" value={head.totalMatches ?? 0} palette={palette} />
          <ScoreLine label="Victoires vs toi" value={head.losses ?? 0} palette={palette} />
          <ScoreLine label="Defaites vs toi" value={head.wins ?? 0} palette={palette} />
          <ScoreLine label="Ton winrate" value={`${head.winRate ?? 0}%`} palette={palette} />
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Badges</Text>
        <View style={styles.badgesWrap}>
          {badges.map((badge) => (
            <View key={badge} style={[styles.badge, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}>
              <Text style={[styles.badgeText, { color: palette.accent }]} numberOfLines={2}>{badgeLabel(badge)}</Text>
            </View>
          ))}
          {badges.length === 0 ? <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Aucun badge debloque pour le moment.</Text> : null}
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Records</Text>
        <ScoreLine label="Plus gros upset" value={`${records?.biggestUpset?.ratingGap ?? 0} pts`} palette={palette} />
        <ScoreLine label="Meilleure serie" value={`${records?.bestWinStreak ?? 0} victoires`} palette={palette} />
        <ScoreLine label="Meilleur set" value={records?.bestSet?.score ?? 'N/A'} palette={palette} />
        <ScoreLine label="Match le plus long" value={`${records?.longestMatch?.minutes ?? 0} min`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Historique recent</Text>
        <View style={styles.matchesWrap}>
          {recentMatches.map((item) => (
            <View key={item.matchId} style={[styles.matchRow, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}>
              <View style={styles.matchTopRow}>
                <Text style={[styles.matchOutcome, { color: item.outcome === 'win' ? palette.accent2 : palette.danger }]}>{item.outcome === 'win' ? 'VICTOIRE' : 'DEFAITE'}</Text>
                <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>{item.mode === 'friendly' ? 'Amical' : 'Classe'}</Text>
              </View>
              <Text style={[styles.matchScore, { color: palette.text }]}>{item.score || 'N/A'}</Text>
              <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>Partenaire: {item.partner}</Text>
              <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>Adversaires: {(item.opponents ?? []).join(' / ')}</Text>
            </View>
          ))}
          {recentMatches.length === 0 ? <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Pas encore de matchs sur cette periode.</Text> : null}
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Activite recente</Text>
        <Heatmap items={profileData?.activityHeatmap ?? []} palette={palette} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  header: { gap: 4 },
  kicker: { fontFamily: theme.fonts.title, fontSize: 11, letterSpacing: 1.1 },
  h1: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 36 },
  sub: { fontFamily: theme.fonts.body, fontSize: 13 },
  cta: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  periodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  periodBtn: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
  },
  periodText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    width: '48%',
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  statValue: { fontFamily: theme.fonts.display, fontSize: 24, lineHeight: 26 },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12 },
  cardTitle: { fontFamily: theme.fonts.title, fontSize: 15, marginBottom: 8 },
  line: {
    minHeight: 34,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontFamily: theme.fonts.body, fontSize: 13 },
  value: { fontFamily: theme.fonts.title, fontSize: 13 },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    minWidth: '31%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  matchesWrap: {
    gap: 8,
  },
  matchRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchOutcome: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  matchScore: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
  },
  matchMeta: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  heatmapWrap: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  heatmapCol: {
    gap: 4,
  },
  heatCell: {
    width: 11,
    height: 11,
    borderRadius: 3,
    borderWidth: 1,
  },
  emptyText: { fontFamily: theme.fonts.body, fontSize: 13 },
  errorTitle: { fontFamily: theme.fonts.title, fontSize: 18, marginBottom: 6 },
  errorText: { fontFamily: theme.fonts.body, fontSize: 14 },
});
