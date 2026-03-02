import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { PirGauge } from '../components/PirGauge';
import { PirSparkline } from '../components/PirSparkline';
import { RankBadge } from '../components/RankBadge';
import { Skeleton } from '../components/Skeleton';
import { StatPill } from '../components/StatPill';
import { AnimatedView, useCountUp, useStaggeredEntry } from '../hooks/usePadelyAnimations';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';
import { configureEngagementNotifications } from '../utils/notifications';

function rankFromRating(rating) {
  if (rating >= 2100) return 'Or I';
  if (rating >= 1800) return 'Argent II';
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

function toDayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function countStreakDays(matches) {
  const days = [...new Set(matches
    .filter((m) => m.status === 'validated')
    .map((m) => toDayKey(m.validatedAt ?? m.createdAt))
    .filter(Boolean))]
    .map((day) => new Date(`${day}T00:00:00`).getTime())
    .sort((a, b) => b - a);

  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i += 1) {
    const deltaDays = Math.round((days[i - 1] - days[i]) / 86400000);
    if (deltaDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user, logout, updateSettings } = useSession();
  const { mode, setMode, palette } = useUi();
  const { language, setLanguage, t } = useI18n();

  const [dashboard, setDashboard] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [cityLeaderboards, setCityLeaderboards] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [pointRule, setPointRule] = useState(user.settings?.pointRule ?? 'punto_de_oro');
  const [matchFormat, setMatchFormat] = useState(user.settings?.matchFormat ?? 'marathon');
  const [defaultMatchMode, setDefaultMatchMode] = useState(user.settings?.defaultMatchMode ?? 'ranked');
  const [autoSaveMatch, setAutoSaveMatch] = useState(Boolean(user.settings?.autoSaveMatch ?? true));
  const [notifPartner, setNotifPartner] = useState(Boolean(user.settings?.notifPartnerAvailable ?? true));
  const [notifMatch, setNotifMatch] = useState(Boolean(user.settings?.notifMatchInvite ?? true));
  const [notifLeaderboard, setNotifLeaderboard] = useState(Boolean(user.settings?.notifLeaderboard ?? false));
  const [publicProfile, setPublicProfile] = useState(Boolean(user.privacy?.publicProfile ?? true));
  const [showGuestMatches, setShowGuestMatches] = useState(Boolean(user.privacy?.showGuestMatches ?? false));
  const [showHealthStats, setShowHealthStats] = useState(Boolean(user.privacy?.showHealthStats ?? true));
  const [appearanceMode, setAppearanceMode] = useState(user.settings?.appearanceMode ?? mode);
  const [languageChoice, setLanguageChoice] = useState(user.settings?.language ?? language);
  const [saveFeedback, setSaveFeedback] = useState('');

  function goPlaySetup() {
    navigation.getParent()?.navigate('PlayTab', { screen: 'PlaySetup' });
  }

  function goCommunity() {
    navigation.getParent()?.navigate('CommunityTab', { screen: 'CommunityMain' });
  }

  function openPlayerProfile(player) {
    if (!player?.userId) return;
    navigation.getParent()?.navigate('CommunityTab', {
      screen: 'PlayerProfile',
      params: {
        playerId: player.userId,
        playerName: player.displayName,
      },
    });
  }

  const loadHome = useCallback(async () => {
    setLoadError('');
    try {
      const [dash, periods, matchesOut, seasonsOut] = await Promise.all([
        api.dashboard(token, user.id),
        api.leaderboardPeriods(token, user.city ?? 'Lyon'),
        api.listMyMatches(token),
        api.seasons(token, user.city ?? 'Lyon'),
      ]);
      setDashboard(dash);
      setCityLeaderboards(periods);
      setRecentMatches(matchesOut);
      setSeasons(seasonsOut);
    } catch (e) {
      setLoadError(e.message || 'Impossible de charger les donnees.');
    }
  }, [token, user.id, user.city]);

  useEffect(() => {
    loadHome().catch(() => {});
  }, [loadHome]);

  useEffect(() => {
    setPointRule(user.settings?.pointRule ?? 'punto_de_oro');
    setMatchFormat(user.settings?.matchFormat ?? 'marathon');
    setDefaultMatchMode(user.settings?.defaultMatchMode ?? 'ranked');
    setAutoSaveMatch(Boolean(user.settings?.autoSaveMatch ?? true));
    setNotifPartner(Boolean(user.settings?.notifPartnerAvailable ?? true));
    setNotifMatch(Boolean(user.settings?.notifMatchInvite ?? true));
    setNotifLeaderboard(Boolean(user.settings?.notifLeaderboard ?? false));
    setPublicProfile(Boolean(user.privacy?.publicProfile ?? true));
    setShowGuestMatches(Boolean(user.privacy?.showGuestMatches ?? false));
    setShowHealthStats(Boolean(user.privacy?.showHealthStats ?? true));
    setAppearanceMode(user.settings?.appearanceMode ?? mode);
    setLanguageChoice(user.settings?.language ?? language);
  }, [user.settings, user.privacy, mode, language]);

  const rating = dashboard?.rating ?? user.rating ?? 1200;
  const pir = dashboard?.pir ?? user.pir ?? 50;
  const wins = dashboard?.wins ?? 0;
  const matches = dashboard?.matches ?? 0;

  const winRate = useMemo(() => (matches ? Math.round((wins / matches) * 100) : 0), [wins, matches]);
  const streakDays = useMemo(() => countStreakDays(recentMatches), [recentMatches]);

  const topRows = (cityLeaderboards?.month?.rows ?? []).slice(0, 3);
  const seasonProgress = Number(seasons?.current?.progress ?? 0);
  const seasonDaysRemaining = Number(seasons?.current?.daysRemaining ?? 0);
  const seasonLabel = seasons?.current?.label ?? 'Saison';
  const seasonRank = Number(seasons?.current?.userRank ?? 0) || null;
  const lastSeasonBadge = seasons?.history?.[0]?.rewardBadge ?? null;
  const progression = dashboard?.progression ?? [];
  const pirHistory = progression.map((point) => ({
    date: point.at,
    value: Number(point.pir ?? point.rating ?? 0),
  }));
  const lastDelta = Number(progression.at(-1)?.delta ?? 0);
  const isLoading = !dashboard && !cityLeaderboards && !seasons;
  const pirLive = useCountUp(pir);
  const ratingLive = useCountUp(rating);
  const choiceActiveStyle = { backgroundColor: palette.accent, borderColor: palette.accent };
  const choiceActiveTextStyle = { color: palette.accentText };
  const heroEntry = useStaggeredEntry(0, !isLoading);
  const actionsEntry = useStaggeredEntry(1, !isLoading);
  const boardEntry = useStaggeredEntry(2, !isLoading);
  const seasonEntry = useStaggeredEntry(3, !isLoading);
  const logoutEntry = useStaggeredEntry(4, !isLoading);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadHome();
    } finally {
      setRefreshing(false);
    }
  }

  async function savePrefs() {
    setSaveFeedback('');
    try {
      await updateSettings({
        settings: {
          pointRule,
          matchFormat,
          defaultMatchMode,
          autoSaveMatch,
          notifPartnerAvailable: notifPartner,
          notifMatchInvite: notifMatch,
          notifLeaderboard,
          appearanceMode,
          language: languageChoice,
          autoSideSwitch: true,
        },
        privacy: {
          publicProfile,
          showGuestMatches,
          showHealthStats,
        },
      });
      const notifState = await configureEngagementNotifications({
        notifPartnerAvailable: notifPartner,
        notifMatchInvite: notifMatch,
        notifLeaderboard,
        language: languageChoice,
      });
      if (notifState.enabled) {
        setSaveFeedback(t('home.notifSaved', { count: notifState.scheduled }));
      } else {
        setSaveFeedback(t('home.notifDenied'));
      }
      setMode(appearanceMode === 'day' ? 'day' : 'night');
      setLanguage(languageChoice === 'en' ? 'en' : 'fr');
    } catch (e) {
      setSaveFeedback(e.message);
    }
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent2} />}
      >
        <View style={styles.headerRow}>
          <Text numberOfLines={1} style={[styles.h1, { color: palette.text }]}>{t('home.hello', { name: user.displayName })}</Text>
          <Pressable style={[styles.gearBtn, { backgroundColor: palette.cardStrong, borderColor: palette.line }]} onPress={() => setSettingsOpen(true)}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M11.05 2.93c.46-.83 1.64-.83 2.1 0l.63 1.15c.2.37.63.54 1.03.43l1.26-.35c.91-.25 1.75.59 1.5 1.5l-.35 1.26c-.11.4.06.83.43 1.03l1.15.63c.83.46.83 1.64 0 2.1l-1.15.63c-.37.2-.54.63-.43 1.03l.35 1.26c.25.91-.59 1.75-1.5 1.5l-1.26-.35c-.4-.11-.83.06-1.03.43l-.63 1.15c-.46.83-1.64.83-2.1 0l-.63-1.15c-.2-.37-.63-.54-1.03-.43l-1.26.35c-.91.25-1.75-.59-1.5-1.5l.35-1.26c.11-.4-.06-.83-.43-1.03l-1.15-.63c-.83-.46-.83-1.64 0-2.1l1.15-.63c.37-.2.54-.63.43-1.03l-.35-1.26c-.25-.91.59-1.75 1.5-1.5l1.26.35c.4.11.83-.06 1.03-.43l.63-1.15z"
                stroke={palette.text}
                strokeWidth={1.4}
                fill="none"
              />
              <Circle cx="12" cy="12" r="3.1" stroke={palette.text} strokeWidth={1.4} fill="none" />
            </Svg>
          </Pressable>
        </View>

        {isLoading && !loadError ? (
          <>
            <Card elevated style={styles.heroCard}>
              <Skeleton width={120} height={12} />
              <Skeleton width="100%" height={180} radius={16} />
              <Skeleton width="100%" height={42} radius={14} />
            </Card>
            <Card elevated>
              <Skeleton width={180} height={12} />
              <View style={styles.quickRow}>
                <Skeleton width="49%" height={52} radius={14} />
                <Skeleton width="49%" height={52} radius={14} />
              </View>
            </Card>
            <Card>
              <Skeleton width={180} height={12} />
              <View style={styles.boardRows}>
                <Skeleton width="100%" height={44} />
                <Skeleton width="100%" height={44} />
                <Skeleton width="100%" height={44} />
              </View>
            </Card>
            <Card elevated>
              <Skeleton width={200} height={12} />
              <Skeleton width="100%" height={12} style={{ marginTop: 10 }} />
              <Skeleton width={130} height={10} style={{ marginTop: 8 }} />
            </Card>
          </>
        ) : loadError ? (
          <Card elevated>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Connexion API</Text>
            <Text style={[styles.empty, { color: palette.warning }]}>{loadError}</Text>
            <Pressable style={[styles.quickBtnPrimary, { backgroundColor: palette.accent, marginTop: 10 }]} onPress={onRefresh}>
              <Text style={styles.quickBtnPrimaryText}>Reessayer</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <AnimatedView style={heroEntry}>
              <Card elevated style={styles.heroCard}>
                <View style={styles.heroHead}>
                  <Text style={[styles.eyebrow, { color: palette.accent2 }]}>{t('home.pirLive')}</Text>
                  <RankBadge rank={rankFromRating(rating)} />
                </View>
                <Text style={[styles.heroMetric, { color: palette.text }]}>{`PIR ${pirLive} · ${t('home.heroRank', { rank: rankFromRating(rating), rating: ratingLive })}`}</Text>
                <PirGauge pir={pir} delta={lastDelta} rank={rankFromRating(rating)} size={160} strokeWidth={8} />
                <PirSparkline data={pirHistory} />
                <View style={styles.pillsRow}>
                  <StatPill value={wins} label={t('home.wins')} />
                  <StatPill value={`${winRate}%`} label={t('home.winRate')} highlight />
                  <StatPill value={`🔥 ${streakDays}`} label={t('home.streak')} />
                </View>
              </Card>
            </AnimatedView>

            <AnimatedView style={actionsEntry}>
              <Card elevated>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('home.launchTitle')}</Text>
                <View style={styles.quickRow}>
                  <Pressable style={[styles.quickBtnPrimary, { backgroundColor: palette.accent }]} onPress={goPlaySetup}>
                    <Text style={[styles.quickBtnPrimaryText, { color: palette.accentText }]}>{t('home.launchRanked')}</Text>
                  </Pressable>
                  <Pressable style={[styles.quickBtnGhost, { borderColor: palette.line, backgroundColor: palette.chip }]} onPress={goCommunity}>
                    <Text style={[styles.quickBtnGhostText, { color: palette.text }]}>{t('home.launchFind')}</Text>
                  </Pressable>
                </View>
              </Card>
            </AnimatedView>

            <AnimatedView style={boardEntry}>
              <Card>
                <View style={styles.boardHead}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('home.cityTop3', { city: user.city ?? 'Lyon' })}</Text>
                  <Text style={[styles.boardMeta, { color: palette.textSecondary ?? palette.muted }]}>{t('home.monthRank')}</Text>
                </View>
                <View style={styles.boardRows}>
                  {topRows.map((row) => (
                    <LeaderboardRow
                      key={row.userId}
                      row={row}
                      podium
                      onPress={openPlayerProfile}
                      isCurrentUser={row.userId === user.id}
                      currentUserLabel={t('home.you')}
                    />
                  ))}
                  {topRows.length === 0 ? (
                    <EmptyState title={t('home.emptyBoardTitle')} body={t('home.emptyBoardBody')} compact />
                  ) : null}
                </View>
              </Card>
            </AnimatedView>

            <AnimatedView style={seasonEntry}>
              <Card elevated>
                <View style={styles.seasonHead}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('home.seasonTitle', { label: seasonLabel })}</Text>
                  <Text style={[styles.seasonRank, { color: palette.accent }]}>
                    {seasonRank ? t('home.seasonRank', { rank: seasonRank }) : t('home.seasonUnranked')}
                  </Text>
                </View>
                <View style={[styles.seasonBarTrack, { backgroundColor: palette.bgAlt, borderColor: palette.line }]}>
                  <View style={[styles.seasonBarFill, { width: `${Math.max(3, Math.min(100, seasonProgress * 100))}%`, backgroundColor: palette.accent }]} />
                </View>
                <Text style={[styles.seasonMeta, { color: palette.textSecondary ?? palette.muted }]}>
                  {t('home.seasonDaysLeft', { days: seasonDaysRemaining })}
                </Text>
                {lastSeasonBadge ? (
                  <Text style={[styles.seasonBadge, { color: palette.accent2 }]}>
                    {t('home.lastSeasonBadge', { badge: lastSeasonBadge })}
                  </Text>
                ) : null}
              </Card>
            </AnimatedView>

            <AnimatedView style={logoutEntry}>
              <Pressable style={[styles.logout, { backgroundColor: palette.cardStrong, borderColor: palette.line }]} onPress={logout}>
                <Text style={[styles.logoutLabel, { color: palette.text }]}>{t('home.logout')}</Text>
              </Pressable>
            </AnimatedView>
          </>
        )}
      </ScrollView>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.line }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>{t('home.settingsTitle')}</Text>

            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('home.pointRule')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, pointRule === 'punto_de_oro' && choiceActiveStyle]}
                onPress={() => setPointRule('punto_de_oro')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, pointRule === 'punto_de_oro' && choiceActiveTextStyle]}>{t('home.pointPunto')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, pointRule === 'avantage' && choiceActiveStyle]}
                onPress={() => setPointRule('avantage')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, pointRule === 'avantage' && choiceActiveTextStyle]}>{t('home.pointAdv')}</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('home.matchFormat')}</Text>
            <View style={styles.choiceWrap}>
              {[
                { key: 'standard', label: t('home.standard') },
                { key: 'club', label: t('home.club') },
                { key: 'marathon', label: t('home.marathon') },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.choiceBtnWide, { borderColor: palette.line, backgroundColor: palette.chip }, matchFormat === item.key && choiceActiveStyle]}
                  onPress={() => setMatchFormat(item.key)}
                >
                  <Text style={[styles.choiceText, { color: palette.text }, matchFormat === item.key && choiceActiveTextStyle]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('home.modeDefault')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, defaultMatchMode === 'ranked' && choiceActiveStyle]}
                onPress={() => setDefaultMatchMode('ranked')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, defaultMatchMode === 'ranked' && choiceActiveTextStyle]}>{t('home.ranked')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, defaultMatchMode === 'friendly' && choiceActiveStyle]}
                onPress={() => setDefaultMatchMode('friendly')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, defaultMatchMode === 'friendly' && choiceActiveTextStyle]}>{t('home.friendly')}</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('home.appearance')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, appearanceMode === 'night' && choiceActiveStyle]}
                onPress={() => setAppearanceMode('night')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, appearanceMode === 'night' && choiceActiveTextStyle]}>{t('home.night')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, appearanceMode === 'day' && choiceActiveStyle]}
                onPress={() => setAppearanceMode('day')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, appearanceMode === 'day' && choiceActiveTextStyle]}>{t('home.day')}</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalLabel, { color: palette.muted }]}>{t('home.language')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, languageChoice === 'fr' && choiceActiveStyle]}
                onPress={() => setLanguageChoice('fr')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, languageChoice === 'fr' && choiceActiveTextStyle]}>FR</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, { borderColor: palette.line, backgroundColor: palette.chip }, languageChoice === 'en' && choiceActiveStyle]}
                onPress={() => setLanguageChoice('en')}
              >
                <Text style={[styles.choiceText, { color: palette.text }, languageChoice === 'en' && choiceActiveTextStyle]}>EN</Text>
              </Pressable>
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.autoSave')}</Text>
              <Switch value={autoSaveMatch} onValueChange={setAutoSaveMatch} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.notifPartner')}</Text>
              <Switch value={notifPartner} onValueChange={setNotifPartner} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.notifInvite')}</Text>
              <Switch value={notifMatch} onValueChange={setNotifMatch} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.notifLeaderboard')}</Text>
              <Switch value={notifLeaderboard} onValueChange={setNotifLeaderboard} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.publicProfile')}</Text>
              <Switch value={publicProfile} onValueChange={setPublicProfile} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.showGuest')}</Text>
              <Switch value={showGuestMatches} onValueChange={setShowGuestMatches} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: palette.muted }]}>{t('home.showHealth')}</Text>
              <Switch value={showHealthStats} onValueChange={setShowHealthStats} />
            </View>

            {!!saveFeedback && <Text style={[styles.feedback, { color: palette.accent2 }]}>{saveFeedback}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: palette.accent }]} onPress={savePrefs}>
                <Text style={[styles.modalBtnText, { color: palette.accentText }]}>{t('home.save')}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { borderColor: palette.line, backgroundColor: palette.chip }]} onPress={() => setSettingsOpen(false)}>
                <Text style={[styles.modalBtnText, { color: palette.text }]}>{t('home.close')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 26 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontFamily: theme.fonts.display, fontSize: 38, lineHeight: 40 },
  eyebrow: { fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1 },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroCard: { gap: 8 },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMetric: { fontFamily: theme.fonts.body, fontSize: 12 },
  pillsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  quickBtnPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBtnPrimaryText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 12,
  },
  quickBtnGhost: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  quickBtnGhostText: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 12,
  },
  sectionTitle: { fontFamily: theme.fonts.title, fontSize: 16 },
  boardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boardMeta: { fontFamily: theme.fonts.body, fontSize: 12 },
  seasonHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seasonRank: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  seasonBarTrack: {
    marginTop: 10,
    height: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seasonBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  seasonMeta: { marginTop: 8, fontFamily: theme.fonts.body, fontSize: 12 },
  seasonBadge: { marginTop: 4, fontFamily: theme.fonts.title, fontSize: 12 },
  boardRows: { gap: 8, marginTop: 8 },
  logout: {
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutLabel: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 14, 0.72)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 18,
    marginBottom: 2,
  },
  modalLabel: {
    marginTop: 6,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceBtnWide: {
    minWidth: 94,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  choiceText: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  switchLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  feedback: {
    marginTop: 4,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalBtnText: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 11,
  },
});
