import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { PlayerCard } from '../components/PlayerCard';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const PERIODS = ['week', 'month', 'season', 'all'];

function Heatmap({ items = [], palette }) {
  const weeks = useMemo(() => {
    const out = [];
    for (let index = 0; index < items.length; index += 1) {
      const week = Math.floor(index / 7);
      if (!out[week]) {
        out[week] = [];
      }
      out[week].push(items[index]);
    }
    return out;
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
  const { t } = useI18n();
  const { palette } = useUi();
  const playerId = String(route.params?.playerId ?? '');

  const [period, setPeriod] = useState('season');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState(null);

  async function load() {
    if (!playerId) {
      setError(t('playerProfile.notFound'));
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
          <Text style={[styles.errorTitle, { color: palette.text }]}>{t('playerProfile.unavailableTitle')}</Text>
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
        <Text style={[styles.kicker, { color: palette.accent }]}>{t('playerProfile.kicker')}</Text>
        <Text style={[styles.h1, { color: palette.text }]}>{profile.displayName ?? route.params?.playerName ?? t('profile.playerFallback')}</Text>
      </View>

      <PlayerCard
        size="compact"
        player={{ displayName: profile.displayName, arcadeTag: profile.arcadeTag }}
        pir={profile.pir}
        rating={profile.rating}
        formScore={0}
        personality={null}
        type={null}
        pinnedBadges={[]}
        pirDna={{}}
      />

      <Text style={[styles.sub, { color: palette.textSecondary }]}>{t('playerProfile.rankLine', {
        pir: Math.round(Number(profile.pir ?? 0)),
        rating: Math.round(Number(profile.rating ?? 0)),
        city: profile.city ?? t('community.unknownCity'),
      })}</Text>

      {playerId !== user.id ? (
        <Pressable style={[styles.cta, { backgroundColor: palette.accent }]} onPress={proposeMatch}>
          <Text style={[styles.ctaText, { color: palette.accentText }]}>{t('playerProfile.proposeMatch')}</Text>
        </Pressable>
      ) : null}

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
              <Text style={[styles.periodText, { color: active ? palette.accent : palette.textSecondary }]}>{t(`playerProfile.period_${key}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsGrid}>
        <StatTile label={t('playerProfile.statMatches')} value={stats.matches ?? 0} palette={palette} />
        <StatTile label={t('playerProfile.statWinrate')} value={`${stats.winRate ?? 0}%`} palette={palette} />
        <StatTile label={t('playerProfile.statRegularity')} value={stats.regularityScore ?? 0} palette={palette} />
        <StatTile label={t('playerProfile.statConsistency')} value={stats.consistencyScore ?? 0} palette={palette} />
      </View>

      {head ? (
        <Card elevated>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{t('playerProfile.headTitle')}</Text>
          <ScoreLine label={t('playerProfile.headTotal')} value={head.totalMatches ?? 0} palette={palette} />
          <ScoreLine label={t('playerProfile.headWins')} value={head.losses ?? 0} palette={palette} />
          <ScoreLine label={t('playerProfile.headLosses')} value={head.wins ?? 0} palette={palette} />
          <ScoreLine label={t('playerProfile.headRate')} value={`${head.winRate ?? 0}%`} palette={palette} />
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('playerProfile.badgesTitle')}</Text>
        <View style={styles.badgesWrap}>
          {badges.map((badge) => (
            <View key={badge} style={[styles.badge, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}> 
              <Text style={[styles.badgeText, { color: palette.accent }]} numberOfLines={2}>{badgeLabel(badge)}</Text>
            </View>
          ))}
          {badges.length === 0 ? <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('playerProfile.badgesEmpty')}</Text> : null}
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('playerProfile.recordsTitle')}</Text>
        <ScoreLine label={t('playerProfile.recordUpset')} value={`${records?.biggestUpset?.ratingGap ?? 0} pts`} palette={palette} />
        <ScoreLine label={t('playerProfile.recordStreak')} value={`${records?.bestWinStreak ?? 0}`} palette={palette} />
        <ScoreLine label={t('playerProfile.recordBestSet')} value={records?.bestSet?.score ?? t('playerProfile.na')} palette={palette} />
        <ScoreLine label={t('playerProfile.recordLongest')} value={`${records?.longestMatch?.minutes ?? 0} min`} palette={palette} />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('playerProfile.recentTitle')}</Text>
        <View style={styles.matchesWrap}>
          {recentMatches.map((item) => (
            <View key={item.matchId} style={[styles.matchRow, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
              <View style={styles.matchTopRow}>
                <Text style={[styles.matchOutcome, { color: item.outcome === 'win' ? palette.accent2 : palette.danger }]}>
                  {item.outcome === 'win' ? t('playerProfile.outcomeWin') : t('playerProfile.outcomeLoss')}
                </Text>
                <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>{item.mode === 'friendly' ? t('home.friendly') : t('home.ranked')}</Text>
              </View>
              <Text style={[styles.matchScore, { color: palette.text }]}>{item.score || t('playerProfile.na')}</Text>
              <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>{t('playerProfile.partnerLine', { name: item.partner ?? t('playerProfile.na') })}</Text>
              <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>{t('playerProfile.opponentsLine', { names: (item.opponents ?? []).join(' / ') || t('playerProfile.na') })}</Text>
            </View>
          ))}
          {recentMatches.length === 0 ? <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('playerProfile.recentEmpty')}</Text> : null}
        </View>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{t('playerProfile.activityTitle')}</Text>
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
  cardTitle: { fontFamily: theme.fonts.title, fontSize: 14, marginBottom: 8 },
  line: {
    minHeight: 36,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontFamily: theme.fonts.body, fontSize: 12 },
  value: { fontFamily: theme.fonts.title, fontSize: 13 },
  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyText: { fontFamily: theme.fonts.body, fontSize: 12 },
  matchesWrap: { gap: 8 },
  matchRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchOutcome: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  matchScore: { fontFamily: theme.fonts.display, fontSize: 20, lineHeight: 22 },
  matchMeta: { fontFamily: theme.fonts.body, fontSize: 11 },
  heatmapWrap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  heatmapCol: { gap: 3 },
  heatCell: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  errorTitle: { fontFamily: theme.fonts.title, fontSize: 16 },
  errorText: { marginTop: 6, fontFamily: theme.fonts.body, fontSize: 12 },
});
