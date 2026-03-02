import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
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
    if (!level) {
      return palette.accentMuted;
    }
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

function ScoreLine({ label, value, palette }) {
  return (
    <View style={[styles.line, { borderBottomColor: palette.line }]}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

export function PlayerProfileScreen() {
  const route = useRoute();
  const { token, user } = useSession();
  const { palette } = useUi();
  const playerId = String(route.params?.playerId ?? '');

  const [period, setPeriod] = useState('season');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [head, setHead] = useState(null);
  const [records, setRecords] = useState(null);

  async function load() {
    if (!playerId) {
      setError('Profil joueur introuvable.');
      setLoading(false);
      return;
    }

    setError('');
    const [dashOut, headOut, recordsOut] = await Promise.all([
      api.dashboard(token, playerId, period),
      api.headToHead(token, user.id, playerId, period),
      api.records(token, playerId, period),
    ]);
    setDashboard(dashOut);
    setHead(headOut);
    setRecords(recordsOut);
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
  }, [token, user.id, playerId, period]);

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

  const profile = records?.profile ?? {};

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>PROFIL JOUEUR</Text>
        <Text style={[styles.h1, { color: palette.text }]}>{profile.displayName ?? route.params?.playerName ?? 'Joueur'}</Text>
        <Text style={[styles.sub, { color: palette.textSecondary }]}>PIR {Math.round(profile.pir ?? dashboard?.pir ?? 0)} · Classement {Math.round(profile.rating ?? dashboard?.rating ?? 0)}</Text>
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

      <Card elevated>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Face-a-face</Text>
        <ScoreLine label="Confrontations" value={head?.totalMatches ?? 0} palette={palette} />
        <ScoreLine label="Victoires vs toi" value={head?.losses ?? 0} palette={palette} />
        <ScoreLine label="Defaites vs toi" value={head?.wins ?? 0} palette={palette} />
        <ScoreLine label="Ton winrate" value={`${head?.winRate ?? 0}%`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Records</Text>
        <ScoreLine label="Plus gros upset" value={`${records?.records?.biggestUpset?.ratingGap ?? 0} pts`} palette={palette} />
        <ScoreLine label="Meilleure serie" value={`${records?.records?.bestWinStreak ?? 0} victoires`} palette={palette} />
        <ScoreLine label="Meilleur set" value={records?.records?.bestSet?.score ?? 'N/A'} palette={palette} />
        <ScoreLine label="Match le plus long" value={`${records?.records?.longestMatch?.minutes ?? 0} min`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Activite recente</Text>
        <Heatmap items={records?.activityHeatmap ?? dashboard?.activityHeatmap ?? []} palette={palette} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  header: { gap: 3 },
  kicker: { fontFamily: theme.fonts.title, fontSize: 11, letterSpacing: 1.1 },
  h1: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 36 },
  sub: { fontFamily: theme.fonts.body, fontSize: 13 },
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
  errorTitle: { fontFamily: theme.fonts.title, fontSize: 18, marginBottom: 6 },
  errorText: { fontFamily: theme.fonts.body, fontSize: 14 },
});
