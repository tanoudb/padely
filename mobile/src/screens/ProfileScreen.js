import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { AnimatedView, useCountUp, useScaleBounce, useStaggeredEntry } from '../hooks/usePadelyAnimations';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const PERIODS = ['week', 'month', 'season', 'all'];
const BADGE_FALLBACK = [
  { key: 'first_blood', title: 'First Blood', description: 'Valider ton premier match.' },
  { key: 'serial_winner', title: 'Serial Winner', description: '6 victoires consecutives.' },
  { key: 'ironman', title: 'Ironman', description: '30 matchs valides.' },
  { key: 'upset_king', title: 'Upset King', description: 'Upset de 180+ points.' },
  { key: 'golden_touch', title: 'Golden Touch', description: '15 puntos de oro.' },
  { key: 'social_butterfly', title: 'Social Butterfly', description: 'Reseau local actif.' },
  { key: 'city_champion', title: 'City Champion', description: 'Top 1 de ta ville.' },
  { key: 'marathon_man', title: 'Marathon Man', description: '15h de jeu ou 5 marathons.' },
];

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

function BadgeUnlockOverlay({ badge, palette }) {
  const reveal = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!badge) {
      reveal.value = withTiming(0, { duration: 180 });
      return;
    }
    reveal.value = 0;
    pulse.value = 0;
    reveal.value = withSpring(1, { damping: 15, stiffness: 150, mass: 0.8 });
    pulse.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 350, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
    );
  }, [badge, pulse, reveal]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * -26 },
      { scale: 0.96 + reveal.value * 0.04 },
    ],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.95,
    transform: [{ scale: 0.6 + pulse.value * 0.55 }],
  }));

  if (!badge) {
    return null;
  }

  return (
    <Animated.View style={[styles.unlockOverlay, wrapStyle, { backgroundColor: palette.bgElevated ?? palette.card, borderColor: palette.accent }]}>
      <Animated.View style={[styles.sparkleA, sparkleStyle, { backgroundColor: palette.accent }]} />
      <Animated.View style={[styles.sparkleB, sparkleStyle, { backgroundColor: palette.accent2 }]} />
      <Animated.View style={[styles.sparkleC, sparkleStyle, { backgroundColor: palette.accent }]} />
      <Text style={[styles.unlockKicker, { color: palette.accent }]}>NOUVEAU BADGE</Text>
      <Text style={[styles.unlockTitle, { color: palette.text }]}>{badge.title}</Text>
      <Text style={[styles.unlockSub, { color: palette.textSecondary }]} numberOfLines={2}>{badge.description}</Text>
    </Animated.View>
  );
}

function BadgeGrid({ catalog, palette }) {
  const rows = Array.isArray(catalog) && catalog.length ? catalog : BADGE_FALLBACK;
  return (
    <View style={styles.badgeGrid}>
      {rows.map((badge) => {
        const unlocked = Boolean(badge.unlocked);
        return (
          <View
            key={badge.key}
            style={[
              styles.badgeCell,
              {
                backgroundColor: unlocked ? palette.accentMuted : palette.bgAlt,
                borderColor: unlocked ? palette.accent : palette.line,
                shadowColor: unlocked ? palette.accent : 'transparent',
                opacity: unlocked ? 1 : 0.8,
              },
            ]}
          >
            <Text style={[styles.badgeCellTitle, { color: unlocked ? palette.accent : palette.textSecondary }]} numberOfLines={2}>{badge.title}</Text>
            <Text style={[styles.badgeCellDesc, { color: palette.textSecondary }]} numberOfLines={3}>{badge.description}</Text>
            <Text style={[styles.badgeCellState, { color: unlocked ? palette.accent2 : palette.muted }]}>{unlocked ? 'UNLOCKED' : 'LOCKED'}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [dashboard, setDashboard] = useState(null);
  const [duos, setDuos] = useState([]);
  const [players, setPlayers] = useState([]);
  const [records, setRecords] = useState(null);
  const [period, setPeriod] = useState('season');
  const [loadError, setLoadError] = useState('');
  const [badges, setBadges] = useState(BADGE_FALLBACK);
  const [unlockQueue, setUnlockQueue] = useState([]);
  const [activeUnlock, setActiveUnlock] = useState(null);

  const [view, setView] = useState('profile');
  const [refreshing, setRefreshing] = useState(false);

  async function loadProfileData() {
    setLoadError('');
    try {
      const [db, duoStats, playerList, recordsOut] = await Promise.all([
        api.dashboard(token, user.id, period),
        api.duoStats(token, user.id, period),
        api.listPlayers(token),
        api.records(token, user.id, period),
      ]);
      const badgeOut = await api.badges(token, user.id);
      setDashboard(db);
      setDuos(duoStats);
      setPlayers(playerList);
      setRecords(recordsOut);
      setBadges(Array.isArray(badgeOut?.catalog) && badgeOut.catalog.length ? badgeOut.catalog : BADGE_FALLBACK);
      if (Array.isArray(badgeOut?.newlyUnlocked) && badgeOut.newlyUnlocked.length) {
        setUnlockQueue((current) => {
          const seen = new Set(current.map((entry) => `${entry.badgeKey}:${entry.unlockedAt}`));
          const appended = badgeOut.newlyUnlocked
            .filter((entry) => !seen.has(`${entry.badgeKey}:${entry.unlockedAt}`))
            .map((entry) => ({
              ...entry,
              description: (badgeOut.catalog ?? BADGE_FALLBACK).find((item) => item.key === entry.badgeKey)?.description ?? '',
            }));
          return [...current, ...appended];
        });
      }
    } catch (e) {
      setLoadError(e.message || 'Impossible de charger le profil.');
    }
  }

  useEffect(() => {
    loadProfileData().catch(() => {});
  }, [token, user.id, period]);

  useEffect(() => {
    if (activeUnlock || unlockQueue.length === 0) {
      return;
    }
    const next = unlockQueue[0];
    setActiveUnlock(next);
    setUnlockQueue((current) => current.slice(1));
    const timer = setTimeout(() => {
      setActiveUnlock(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [activeUnlock, unlockQueue]);

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
  const isLoading = !dashboard && !records;
  const pirLive = useCountUp(pir);
  const ratingLive = useCountUp(rating);
  const identityEntry = useStaggeredEntry(0, !isLoading);
  const statsEntry = useStaggeredEntry(1, !isLoading);
  const recordsEntry = useStaggeredEntry(2, !isLoading);
  const badgesEntry = useStaggeredEntry(3, !isLoading);
  const heatmapEntry = useStaggeredEntry(4, !isLoading);
  const ctaEntry = useStaggeredEntry(5, !isLoading);
  const ctaBounce = useScaleBounce(sortedDuos.length);
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
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent2} />}
      >
        <View style={styles.headerRow}>
          <Pressable style={[styles.backBtn, { backgroundColor: palette.cardStrong }]} onPress={() => setView('profile')}>
            <Text style={[styles.backBtnText, { color: palette.text }]}>{t('profile.backProfile')}</Text>
          </Pressable>
          <Text style={[styles.h1, { color: palette.text }]} numberOfLines={1}>{t('profile.partnersTitle')}</Text>
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
            <EmptyState title={t('profile.emptyPartnersTitle')} body={t('profile.emptyPartnersBody')} variant="profile" compact />
          )}
        </Card>

        <Card>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.allPairs')}</Text>
          {sortedDuos.length === 0 ? (
            <EmptyState title={t('profile.emptyPartnersTitle')} body={t('profile.allPairsEmpty')} variant="profile" compact />
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
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 24) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent2} />}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: palette.accent2 }]}>{t('profile.space')}</Text>
        <Text style={[styles.h1, { color: palette.text }]} numberOfLines={1}>{t('profile.title')}</Text>
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

      {isLoading && !loadError ? (
        <>
          <Card elevated style={styles.identityCard}>
            <Skeleton width={72} height={72} radius={36} />
            <View style={styles.identityInfo}>
              <Skeleton width="68%" height={18} />
              <Skeleton width="40%" height={14} />
              <Skeleton width="88%" height={12} />
              <Skeleton width={120} height={34} radius={9} style={{ marginTop: 8 }} />
            </View>
          </Card>
          <Card>
            <Skeleton width={160} height={14} />
            <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
            <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
          </Card>
          <Card>
            <Skeleton width={140} height={14} />
            <Skeleton width="100%" height={118} radius={14} style={{ marginTop: 10 }} />
          </Card>
        </>
      ) : loadError ? (
        <Card elevated>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{t('home.loadErrorTitle')}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{loadError}</Text>
          <Pressable style={[styles.cta, { backgroundColor: palette.accent, marginTop: 12 }]} onPress={onRefresh}>
            <Text style={[styles.ctaText, { color: palette.accentText }]}>{t('home.retry')}</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <AnimatedView style={identityEntry}>
            <Card elevated style={styles.identityCard}>
              <View style={[styles.avatarCircle, { backgroundColor: palette.cardStrong, borderColor: palette.lineStrong ?? palette.line }]}>
                <Text style={[styles.avatarText, { color: palette.text }]}>{initials}</Text>
              </View>
              <View style={styles.identityInfo}>
                <Text style={[styles.playerName, { color: palette.text }]}>{user.displayName}</Text>
                <Text style={[styles.rankText, { color: palette.accent }]}>{rankFromRating(rating)}</Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.rankLine', { pir: pirLive, rating: ratingLive })}</Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.arcadeTag', { tag: arcadeTag })}</Text>
                <Pressable style={[styles.shareTagBtn, { borderColor: palette.line, backgroundColor: palette.cardStrong }]} onPress={shareArcadeTag}>
                  <Text style={[styles.shareTagText, { color: palette.text }]}>{t('profile.shareQr')}</Text>
                </Pressable>
              </View>
            </Card>
          </AnimatedView>

          <AnimatedView style={statsEntry}>
            <Card>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.global')}</Text>
              <StatLine label={t('profile.statWins')} value={dashboard?.wins ?? 0} palette={palette} />
              <StatLine label={t('profile.statLosses')} value={dashboard?.losses ?? 0} palette={palette} />
              <StatLine label={t('profile.statTotalDistance')} value={`${dashboard?.totalDistanceKm ?? 0} km`} palette={palette} />
              <StatLine label={t('profile.statAverageDistance')} value={`${dashboard?.averageDistanceKm ?? 0} km/match`} palette={palette} />
              <StatLine label={t('profile.statConsistency')} value={`${dashboard?.consistencyScore ?? 0}/100`} palette={palette} />
              <StatLine label={t('profile.statRegularity')} value={`${dashboard?.regularityScore ?? 0}/100`} palette={palette} />
            </Card>
          </AnimatedView>

          <AnimatedView style={recordsEntry}>
            <Card>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.recordsTitle')}</Text>
              <StatLine label={t('profile.recordUpset')} value={`${records?.records?.biggestUpset?.ratingGap ?? 0} pts`} palette={palette} />
              <StatLine label={t('profile.recordStreak')} value={`${records?.records?.bestWinStreak ?? 0}`} palette={palette} />
              <StatLine label={t('profile.recordBestSet')} value={records?.records?.bestSet?.score ?? 'N/A'} palette={palette} />
              <StatLine label={t('profile.recordLongest')} value={`${records?.records?.longestMatch?.minutes ?? 0} min`} palette={palette} />
            </Card>
          </AnimatedView>

          <AnimatedView style={badgesEntry}>
            <Card>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Badges</Text>
              {badges.length ? (
                <BadgeGrid catalog={badges} palette={palette} />
              ) : (
                <EmptyState title={t('profile.emptyBadgeTitle')} body={t('profile.emptyBadgeBody')} variant="profile" compact />
              )}
            </Card>
          </AnimatedView>

          <AnimatedView style={heatmapEntry}>
            <Card>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.heatmapTitle')}</Text>
              {(records?.activityHeatmap ?? dashboard?.activityHeatmap ?? []).length ? (
                <Heatmap items={records?.activityHeatmap ?? dashboard?.activityHeatmap ?? []} palette={palette} />
              ) : (
                <EmptyState title={t('profile.emptyHeatmapTitle')} body={t('profile.emptyHeatmapBody')} variant="profile" compact />
              )}
            </Card>
          </AnimatedView>

          <AnimatedView style={[ctaEntry, ctaBounce]}>
            <Pressable style={[styles.cta, { backgroundColor: palette.accent }]} onPress={() => setView('partners')}>
              <Text style={[styles.ctaText, { color: palette.accentText }]}>{t('profile.seePartners')}</Text>
            </Pressable>
          </AnimatedView>
        </>
      )}
      <BadgeUnlockOverlay badge={activeUnlock} palette={palette} />
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
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCell: {
    width: '23%',
    minHeight: 132,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 9,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    shadowOpacity: 0.22,
    elevation: 2,
  },
  badgeCellTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  badgeCellDesc: {
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 12,
  },
  badgeCellState: {
    fontFamily: theme.fonts.title,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  unlockOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 20,
  },
  unlockKicker: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  unlockTitle: {
    marginTop: 4,
    fontFamily: theme.fonts.display,
    fontSize: 21,
    lineHeight: 24,
  },
  unlockSub: {
    marginTop: 3,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  sparkleA: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 99,
    top: 9,
    right: 18,
  },
  sparkleB: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 99,
    top: 24,
    right: 34,
  },
  sparkleC: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 99,
    top: 17,
    right: 50,
  },
});
