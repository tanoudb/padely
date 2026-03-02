import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { PlayerCard } from '../components/PlayerCard';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function Heatmap({ items = [], palette }) {
  const weeks = [];
  for (let i = 0; i < items.length; i += 1) {
    const week = Math.floor(i / 7);
    if (!weeks[week]) {
      weeks[week] = [];
    }
    weeks[week].push(items[i]);
  }

  function color(level) {
    if (!level) return palette.accentMuted;
    if (level === 1) return palette.accentMuted;
    if (level === 2) return palette.accent;
    if (level === 3) return palette.accent2;
    return palette.accentLight;
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
                  backgroundColor: color(item.intensity),
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

function tierColor(tier, palette) {
  const key = String(tier ?? '').toLowerCase();
  if (key === 'bronze') return palette.tierBronze;
  if (key === 'silver') return palette.tierSilver;
  if (key === 'gold') return palette.tierGold;
  if (key === 'mythic') return palette.tierMythic;
  return palette.lineStrong ?? palette.line;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, updateSettings } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState(null);
  const [badgesPack, setBadgesPack] = useState(null);
  const [profilePack, setProfilePack] = useState(null);
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(Boolean(user?.privacy?.publicProfile ?? true));
  const [privacySaving, setPrivacySaving] = useState(false);

  async function load() {
    const [db, rec, badges, profile] = await Promise.all([
      api.dashboard(token, user.id, 'all'),
      api.records(token, user.id, 'all'),
      api.badges(token, user.id),
      api.playerProfile(token),
    ]);
    setDashboard(db);
    setRecords(rec);
    setBadgesPack(badges);
    setProfilePack(profile);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    load().catch((e) => {
      if (!active) return;
      setError(e.message);
    }).finally(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token, user.id]);

  useEffect(() => {
    setPublicProfileEnabled(Boolean(user?.privacy?.publicProfile ?? true));
  }, [user?.privacy?.publicProfile]);

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  const profile = profilePack?.playerProfile ?? {};
  const allBadges = Array.isArray(badgesPack?.catalog) ? badgesPack.catalog : [];
  const unlocked = allBadges.filter((item) => item.unlocked);
  const pinnedKeys = Array.isArray(user?.settings?.pinnedBadges) ? user.settings.pinnedBadges : [];
  const pinnedBadges = pinnedKeys
    .map((key) => unlocked.find((badge) => badge.key === key))
    .filter(Boolean)
    .slice(0, 3);
  const fallbackPins = unlocked.slice(0, 3 - pinnedBadges.length);
  const cardBadges = [...pinnedBadges, ...fallbackPins].slice(0, 3);

  const pirDna = useMemo(() => ({
    power: Number(dashboard?.records?.biggestUpset?.ratingGap ?? 30),
    stamina: Number(dashboard?.regularityScore ?? 45),
    clutch: Number(dashboard?.consistencyScore ?? 45),
    consistency: Number(dashboard?.consistencyScore ?? 45),
    social: Math.min(100, Number((user?.friends ?? []).length * 8)),
  }), [dashboard?.consistencyScore, dashboard?.records?.biggestUpset?.ratingGap, dashboard?.regularityScore, user?.friends]);

  async function sharePlayerCard() {
    const message = [
      'PADELY',
      `${user.displayName} · ${user.arcadeTag ?? ''}`,
      t('home.formScore', { score: Math.round(Number(profile?.formScore ?? 0)) }),
      `PIR ${Math.round(Number(dashboard?.pir ?? user?.pir ?? 0))}`,
      t(`profile.type.${profile?.type ?? 'regular'}`),
      profile?.personality ? t(`profile.personality.${profile.personality}`) : '',
    ].filter(Boolean).join('\n');

    await Share.share({
      title: 'Padely',
      message,
    });
  }

  async function savePrivacy() {
    setPrivacySaving(true);
    setError('');
    try {
      await updateSettings({
        privacy: {
          publicProfile: publicProfileEnabled,
        },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setPrivacySaving(false);
    }
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 24) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={[styles.title, { color: palette.text }]}>{t('profile.title')}</Text>

      {loading ? (
        <Card elevated>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.loading')}</Text>
        </Card>
      ) : null}

      {!!error && !loading ? (
        <Card elevated>
          <Text style={[styles.meta, { color: palette.danger }]}>{error}</Text>
        </Card>
      ) : null}

      {!loading && !error ? (
        <>
          <View style={styles.heroCardWrap}>
            <PlayerCard
              player={{ displayName: user.displayName, arcadeTag: user.arcadeTag }}
              pir={dashboard?.pir ?? user?.pir}
              rating={dashboard?.rating ?? user?.rating}
              formScore={profile?.formScore ?? 0}
              personality={profile?.personality}
              type={profile?.type}
              pinnedBadges={cardBadges}
              pirDna={pirDna}
              size="large"
            />
            <Pressable style={[styles.shareBtn, { backgroundColor: palette.accent }]} onPress={sharePlayerCard}>
              <Text style={[styles.shareBtnText, { color: palette.accentText }]}>{t('profile.shareCard')}</Text>
            </Pressable>
          </View>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.rivalriesTitle')}</Text>
            {(profile?.rivalries ?? []).slice(0, 3).map((row) => (
              <View key={row.opponentId} style={[styles.line, { borderBottomColor: palette.line }]}> 
                <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.vsLabel', { name: row.opponentId })}</Text>
                <Text style={[styles.value, { color: palette.text }]}>{row.wins}-{row.losses}</Text>
              </View>
            ))}
            {!(profile?.rivalries ?? []).length ? <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.rivalriesEmpty')}</Text> : null}
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.recordsTitle')}</Text>
            <View style={[styles.line, { borderBottomColor: palette.line }]}>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.recordUpset')}</Text>
              <Text style={[styles.value, { color: palette.text }]}>{records?.records?.biggestUpset?.ratingGap ?? 0}</Text>
            </View>
            <View style={[styles.line, { borderBottomColor: palette.line }]}>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.recordStreak')}</Text>
              <Text style={[styles.value, { color: palette.text }]}>{records?.records?.bestWinStreak ?? 0}</Text>
            </View>
            <View style={[styles.line, { borderBottomColor: palette.line }]}>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('profile.recordLongest')}</Text>
              <Text style={[styles.value, { color: palette.text }]}>{records?.records?.longestMatch?.minutes ?? 0}m</Text>
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.heatmapTitle')}</Text>
            <Heatmap items={records?.activityHeatmap ?? []} palette={palette} />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.badgesTitle')}</Text>
            <View style={styles.badgeGrid}>
              {allBadges.slice(0, 16).map((badge) => (
                <View
                  key={badge.key}
                  style={[
                    styles.badgeCell,
                    {
                      borderColor: badge.unlocked ? tierColor(badge.tier, palette) : palette.line,
                      backgroundColor: badge.unlocked ? palette.accentMuted : palette.bgAlt,
                    },
                  ]}
                >
                  <Text numberOfLines={2} style={[styles.badgeText, { color: badge.unlocked ? palette.text : palette.textSecondary }]}>
                    {badge.hiddenLocked ? '???' : badge.title}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.privacy')}</Text>
            <View style={styles.line}>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('home.publicProfile')}</Text>
              <Switch
                value={publicProfileEnabled}
                onValueChange={setPublicProfileEnabled}
                thumbColor={publicProfileEnabled ? palette.accent : palette.muted}
                trackColor={{ true: palette.accentMuted, false: palette.lineStrong ?? palette.line }}
              />
            </View>
            <Pressable
              style={[styles.shareBtn, { backgroundColor: palette.cardStrong, opacity: privacySaving ? 0.7 : 1 }]}
              onPress={savePrivacy}
              disabled={privacySaving}
            >
              <Text style={[styles.shareBtnText, { color: palette.text }]}>
                {privacySaving ? t('onboarding.saving') : t('home.save')}
              </Text>
            </Pressable>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  title: { fontFamily: theme.fonts.display, fontSize: 36, lineHeight: 38 },
  heroCardWrap: { gap: 10 },
  sectionTitle: { fontFamily: theme.fonts.title, fontSize: 15, marginBottom: 8 },
  line: {
    minHeight: 34,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: { fontFamily: theme.fonts.body, fontSize: 12 },
  value: { fontFamily: theme.fonts.title, fontSize: 13 },
  heatmapWrap: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  heatmapCol: { gap: 3 },
  heatCell: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  shareBtn: {
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCell: {
    width: '23%',
    minHeight: 78,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    textAlign: 'center',
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
