import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const PERIODS = ['week', 'month', 'season', 'all'];

function rankFromRating(rating) {
  if (rating >= 2100) return 'Or I';
  if (rating >= 1800) return 'Argent II';
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

function periodLabel(period, t) {
  if (period === 'week') return t('profile.periodWeek');
  if (period === 'month') return t('profile.periodMonth');
  if (period === 'season') return t('profile.periodSeason');
  return t('profile.periodAll');
}

function StatLine({ label, value, palette }) {
  return (
    <View style={[styles.line, { borderBottomColor: palette.line }]}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
    </View>
  );
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

  function colorFor(level) {
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
                  backgroundColor: colorFor(item.intensity),
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

export function ProfileScreen() {
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [dashboard, setDashboard] = useState(null);
  const [duos, setDuos] = useState([]);
  const [players, setPlayers] = useState([]);
  const [records, setRecords] = useState(null);
  const [period, setPeriod] = useState('season');

  const [view, setView] = useState('profile');
  const [refreshing, setRefreshing] = useState(false);

  async function loadProfileData() {
    const [db, duoStats, playerList, recordsOut] = await Promise.all([
      api.dashboard(token, user.id, period),
      api.duoStats(token, user.id, period),
      api.listPlayers(token),
      api.records(token, user.id, period),
    ]);
    setDashboard(db);
    setDuos(duoStats);
    setPlayers(playerList);
    setRecords(recordsOut);
  }

  useEffect(() => {
    loadProfileData().catch(() => {});
  }, [token, user.id, period]);

  const playersById = useMemo(() => {
    const map = new Map();
    for (const p of players) {
      map.set(p.id, p);
    }
    return map;
  }, [players]);

  const sortedDuos = [...duos].sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });

  const bestDuo = sortedDuos[0] ?? null;
  const rating = dashboard?.rating ?? user.rating ?? 1200;
  const pir = dashboard?.pir ?? user.pir ?? 50;
  const initials = (user.displayName ?? 'P').slice(0, 2).toUpperCase();
  const arcadeTag = user.arcadeTag ?? `${(user.displayName ?? 'PLAYER').replace(/\s+/g, '').slice(0, 7).toUpperCase()}#${String(user.id ?? '').slice(-4).toUpperCase()}`;

  async function shareArcadeTag() {
    await Share.share({
      title: t('profile.shareQr'),
      message: `Ajoute-moi sur Padely: ${arcadeTag}\nQR: padely://arcade/${encodeURIComponent(arcadeTag)}`,
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadProfileData();
    } finally {
      setRefreshing(false);
    }
  }

  if (view === 'partners') {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: palette.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent2} />}
      >
        <View style={styles.headerRow}>
          <Pressable style={[styles.backBtn, { backgroundColor: palette.cardStrong }]} onPress={() => setView('profile')}>
            <Text style={[styles.backBtnText, { color: palette.text }]}>{t('profile.backProfile')}</Text>
          </Pressable>
          <Text style={[styles.h1, { color: palette.text }]}>{t('profile.partnersTitle')}</Text>
        </View>

        <Card elevated>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.bestSynergy')}</Text>
          {bestDuo ? (
            <>
              <Text style={[styles.bestName, { color: palette.accent }]}>{playersById.get(bestDuo.partnerId)?.displayName ?? bestDuo.partnerId}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.winRate', { rate: bestDuo.winRate })}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.avgDistance', { distance: bestDuo.averageDistanceKm })}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.matchesTogether', { matches: bestDuo.matches })}</Text>
            </>
          ) : (
            <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.noPair')}</Text>
          )}
        </Card>

        <Card>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.allPairs')}</Text>
          {sortedDuos.length === 0 ? (
            <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.allPairsEmpty')}</Text>
          ) : sortedDuos.map((item) => (
            <View key={item.partnerId} style={[styles.duoRow, { borderBottomColor: palette.line }]}>
              <View>
                <Text style={[styles.duoName, { color: palette.text }]}>{playersById.get(item.partnerId)?.displayName ?? item.partnerId}</Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.pairSummary', { matches: item.matches, distance: item.totalDistanceKm })}</Text>
              </View>
              <Text style={[styles.duoRate, { color: palette.accent2 }]}>{item.winRate}%</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent2} />}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent2 }]}>{t('profile.space')}</Text>
        <Text style={[styles.h1, { color: palette.text }]}>{t('profile.title')}</Text>
        <Text style={[styles.pitch, { color: palette.textSecondary }]}>{t('profile.pitch')}</Text>
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
              <Text style={[styles.periodText, { color: active ? palette.accent : palette.textSecondary }]}>{periodLabel(key, t)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card elevated style={styles.identityCard}>
        <View style={[styles.avatarCircle, { backgroundColor: palette.cardStrong, borderColor: palette.lineStrong ?? palette.line }]}>
          <Text style={[styles.avatarText, { color: palette.text }]}>{initials}</Text>
        </View>
        <View style={styles.identityInfo}>
          <Text style={[styles.playerName, { color: palette.text }]}>{user.displayName}</Text>
          <Text style={[styles.rankText, { color: palette.accent }]}>{rankFromRating(rating)}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.rankLine', { pir: Math.round(pir), rating: Math.round(rating) })}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.arcadeTag', { tag: arcadeTag })}</Text>
          <Pressable style={[styles.shareTagBtn, { borderColor: palette.line, backgroundColor: palette.cardStrong }]} onPress={shareArcadeTag}>
            <Text style={[styles.shareTagText, { color: palette.text }]}>{t('profile.shareQr')}</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.global')}</Text>
        <StatLine label={t('profile.statWins')} value={dashboard?.wins ?? 0} palette={palette} />
        <StatLine label={t('profile.statLosses')} value={dashboard?.losses ?? 0} palette={palette} />
        <StatLine label={t('profile.statTotalDistance')} value={`${dashboard?.totalDistanceKm ?? 0} km`} palette={palette} />
        <StatLine label={t('profile.statAverageDistance')} value={`${dashboard?.averageDistanceKm ?? 0} km/match`} palette={palette} />
        <StatLine label={t('profile.statConsistency')} value={`${dashboard?.consistencyScore ?? 0}/100`} palette={palette} />
        <StatLine label={t('profile.statRegularity')} value={`${dashboard?.regularityScore ?? 0}/100`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.recordsTitle')}</Text>
        <StatLine label={t('profile.recordUpset')} value={`${records?.records?.biggestUpset?.ratingGap ?? 0} pts`} palette={palette} />
        <StatLine label={t('profile.recordStreak')} value={`${records?.records?.bestWinStreak ?? 0}`} palette={palette} />
        <StatLine label={t('profile.recordBestSet')} value={records?.records?.bestSet?.score ?? 'N/A'} palette={palette} />
        <StatLine label={t('profile.recordLongest')} value={`${records?.records?.longestMatch?.minutes ?? 0} min`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.heatmapTitle')}</Text>
        <Heatmap items={records?.activityHeatmap ?? dashboard?.activityHeatmap ?? []} palette={palette} />
      </Card>

      <Pressable style={[styles.cta, { backgroundColor: palette.accent }]} onPress={() => setView('partners')}>
        <Text style={[styles.ctaText, { color: palette.accentText }]}>{t('profile.seePartners')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  headerRow: { marginBottom: 4, gap: 8 },
  eyebrow: { fontFamily: theme.fonts.title, letterSpacing: 1, fontSize: 11 },
  h1: { fontSize: 38, lineHeight: 40, fontFamily: theme.fonts.display },
  pitch: { fontFamily: theme.fonts.body, fontSize: 13, marginTop: 2 },
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
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarText: { fontFamily: theme.fonts.title, fontSize: 24 },
  identityInfo: { flex: 1 },
  playerName: { fontFamily: theme.fonts.title, fontSize: 24 },
  rankText: { fontFamily: theme.fonts.title, fontSize: 16 },
  cardTitle: { fontFamily: theme.fonts.title, fontSize: 16, marginBottom: 8 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: 7,
  },
  label: { fontFamily: theme.fonts.body },
  value: { fontFamily: theme.fonts.title },
  meta: { fontFamily: theme.fonts.body, marginTop: 2 },
  shareTagBtn: {
    marginTop: 8,
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  shareTagText: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cta: {
    minHeight: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  backBtnText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  bestName: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 34 },
  duoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 9,
  },
  duoName: { fontFamily: theme.fonts.title, fontSize: 14 },
  duoRate: { fontFamily: theme.fonts.title, fontSize: 18 },
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
});
