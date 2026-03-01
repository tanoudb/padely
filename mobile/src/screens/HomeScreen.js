import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';
import { configureEngagementNotifications } from '../utils/notifications';

function rankFromRating(rating) {
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

export function HomeScreen({ onNavigate }) {
  const { token, user, logout, updateSettings } = useSession();
  const { mode, setMode } = useUi();
  const { language, setLanguage, t } = useI18n();
  const [dashboard, setDashboard] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
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
  const [cityLeaderboards, setCityLeaderboards] = useState(null);

  useEffect(() => {
    Promise.all([
      api.dashboard(token, user.id),
      api.leaderboardPeriods(token, user.city ?? 'Lyon'),
      api.listMyMatches(token),
    ])
      .then(([dash, periods, matchesOut]) => {
        setDashboard(dash);
        setCityLeaderboards(periods);
        setRecentMatches(matchesOut);
      })
      .catch(() => {});
  }, [token, user.id, user.city]);

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
  const losses = dashboard?.losses ?? 0;
  const matches = dashboard?.matches ?? 0;

  const winRate = useMemo(() => {
    if (!matches) return 0;
    return Math.round((wins / matches) * 100);
  }, [wins, matches]);

  const streakDays = useMemo(() => countStreakDays(recentMatches), [recentMatches]);

  const motivationalMessage = useMemo(() => {
    if (matches < 3) {
      return t('home.motivationStart');
    }
    if (winRate >= 70) {
      return t('home.motivationHot');
    }
    if (winRate >= 50) {
      return t('home.motivationSteady');
    }
    return t('home.motivationRecovery');
  }, [matches, t, winRate]);

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
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{t('home.center')}</Text>
            <Text style={styles.h1}>{t('home.hello', { name: user.displayName })}</Text>
            <Text style={styles.pitch}>{t('home.pitch')}</Text>
          </View>
          <Pressable style={styles.gearBtn} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>

        <Card elevated style={styles.launchPad}>
          <Text style={styles.launchTitle}>{t('home.launchTitle')}</Text>
          <View style={styles.launchActions}>
            <Pressable style={styles.launchBtnPrimary} onPress={() => onNavigate?.('play')}>
              <Text style={styles.launchBtnPrimaryText}>{t('home.launchRanked')}</Text>
            </Pressable>
            <Pressable style={styles.launchBtnGhost} onPress={() => onNavigate?.('crew')}>
              <Text style={styles.launchBtnGhostText}>{t('home.launchFind')}</Text>
            </Pressable>
          </View>
        </Card>

        <Card elevated style={styles.hero}>
          <Text style={styles.heroLabel}>{t('home.pirLive')}</Text>
          <Text style={styles.heroValue}>{Math.round(pir)}</Text>
          <Text style={styles.heroMeta}>{t('home.heroRank', { rank: rankFromRating(rating), rating: Math.round(rating) })}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, pir))}%` }]} />
          </View>
        </Card>

        <View style={styles.grid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('home.wins')}</Text>
            <Text style={styles.metricValue}>{wins}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('home.losses')}</Text>
            <Text style={styles.metricValue}>{losses}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('home.winRate')}</Text>
            <Text style={styles.metricValue}>{winRate}%</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('home.matches')}</Text>
            <Text style={styles.metricValue}>{matches}</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>{t('home.monthlyGoal')}</Text>
          <Text style={styles.sectionText}>{t('home.monthlyGoalBody', { points: Math.max(0, 1500 - Math.round(rating)) })}</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t('home.coachingFocus')}</Text>
          <Text style={styles.sectionText}>{motivationalMessage}</Text>
        </Card>

        <View style={styles.grid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('home.streak')}</Text>
            <Text style={styles.metricValue}>{streakDays} {t('home.daysShort')}</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>{t('home.cityRanking', { city: user.city ?? 'Lyon' })}</Text>
          <View style={styles.rankGroup}>
            <Text style={styles.rankTitle}>{t('home.dayRank')}</Text>
            {(cityLeaderboards?.day?.rows ?? []).slice(0, 3).map((row) => (
              <View style={styles.rankRow} key={`d-${row.userId}`}>
                <Text style={styles.rankLine}>#{row.rank} {row.displayName}</Text>
                <Text style={styles.rankScore}>{Math.round(row.rankingScore ?? row.rating)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.rankGroup}>
            <Text style={styles.rankTitle}>{t('home.weekRank')}</Text>
            {(cityLeaderboards?.week?.rows ?? []).slice(0, 3).map((row) => (
              <View style={styles.rankRow} key={`w-${row.userId}`}>
                <Text style={styles.rankLine}>#{row.rank} {row.displayName}</Text>
                <Text style={styles.rankScore}>{Math.round(row.rankingScore ?? row.rating)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.rankGroup}>
            <Text style={styles.rankTitle}>{t('home.monthRank')}</Text>
            {(cityLeaderboards?.month?.rows ?? []).slice(0, 3).map((row) => (
              <View style={styles.rankRow} key={`m-${row.userId}`}>
                <Text style={styles.rankLine}>#{row.rank} {row.displayName}</Text>
                <Text style={styles.rankScore}>{Math.round(row.rankingScore ?? row.rating)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutLabel}>{t('home.logout')}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('home.settingsTitle')}</Text>

            <Text style={styles.modalLabel}>{t('home.pointRule')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, pointRule === 'punto_de_oro' && styles.choiceBtnActive]}
                onPress={() => setPointRule('punto_de_oro')}
              >
                <Text style={[styles.choiceText, pointRule === 'punto_de_oro' && styles.choiceTextActive]}>{t('home.pointPunto')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, pointRule === 'avantage' && styles.choiceBtnActive]}
                onPress={() => setPointRule('avantage')}
              >
                <Text style={[styles.choiceText, pointRule === 'avantage' && styles.choiceTextActive]}>{t('home.pointAdv')}</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>{t('home.matchFormat')}</Text>
            <View style={styles.choiceWrap}>
              {[
                { key: 'standard', label: t('home.standard') },
                { key: 'club', label: t('home.club') },
                { key: 'marathon', label: t('home.marathon') },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.choiceBtnWide, matchFormat === item.key && styles.choiceBtnActive]}
                  onPress={() => setMatchFormat(item.key)}
                >
                  <Text style={[styles.choiceText, matchFormat === item.key && styles.choiceTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('home.modeDefault')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, defaultMatchMode === 'ranked' && styles.choiceBtnActive]}
                onPress={() => setDefaultMatchMode('ranked')}
              >
                <Text style={[styles.choiceText, defaultMatchMode === 'ranked' && styles.choiceTextActive]}>{t('home.ranked')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, defaultMatchMode === 'friendly' && styles.choiceBtnActive]}
                onPress={() => setDefaultMatchMode('friendly')}
              >
                <Text style={[styles.choiceText, defaultMatchMode === 'friendly' && styles.choiceTextActive]}>{t('home.friendly')}</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>{t('home.appearance')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, appearanceMode === 'night' && styles.choiceBtnActive]}
                onPress={() => {
                  setAppearanceMode('night');
                  setMode('night');
                }}
              >
                <Text style={[styles.choiceText, appearanceMode === 'night' && styles.choiceTextActive]}>{t('home.night')}</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, appearanceMode === 'day' && styles.choiceBtnActive]}
                onPress={() => {
                  setAppearanceMode('day');
                  setMode('day');
                }}
              >
                <Text style={[styles.choiceText, appearanceMode === 'day' && styles.choiceTextActive]}>{t('home.day')}</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>{t('home.language')}</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, languageChoice === 'fr' && styles.choiceBtnActive]}
                onPress={() => {
                  setLanguageChoice('fr');
                  setLanguage('fr');
                }}
              >
                <Text style={[styles.choiceText, languageChoice === 'fr' && styles.choiceTextActive]}>FR</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, languageChoice === 'en' && styles.choiceBtnActive]}
                onPress={() => {
                  setLanguageChoice('en');
                  setLanguage('en');
                }}
              >
                <Text style={[styles.choiceText, languageChoice === 'en' && styles.choiceTextActive]}>EN</Text>
              </Pressable>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.autoSave')}</Text>
              <Switch value={autoSaveMatch} onValueChange={setAutoSaveMatch} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.notifPartner')}</Text>
              <Switch value={notifPartner} onValueChange={setNotifPartner} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.notifInvite')}</Text>
              <Switch value={notifMatch} onValueChange={setNotifMatch} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.notifLeaderboard')}</Text>
              <Switch value={notifLeaderboard} onValueChange={setNotifLeaderboard} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.publicProfile')}</Text>
              <Switch value={publicProfile} onValueChange={setPublicProfile} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.showGuest')}</Text>
              <Switch value={showGuestMatches} onValueChange={setShowGuestMatches} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('home.showHealth')}</Text>
              <Switch value={showHealthStats} onValueChange={setShowHealthStats} />
            </View>

            {!!saveFeedback && <Text style={styles.feedback}>{saveFeedback}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={savePrefs}>
                <Text style={styles.modalBtnText}>{t('home.save')}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setSettingsOpen(false)}>
                <Text style={[styles.modalBtnText, styles.modalBtnGhostText]}>{t('home.close')}</Text>
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
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
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
  pitch: {
    color: '#C4D9E7',
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginTop: 4,
    maxWidth: 290,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2B5873',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearText: { color: '#EAF5FF', fontSize: 20 },
  hero: {
    gap: 4,
  },
  launchPad: {
    gap: 10,
  },
  launchTitle: {
    color: '#F4D35E',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 12,
  },
  launchActions: {
    gap: 8,
  },
  launchBtnPrimary: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  launchBtnPrimaryText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  launchBtnGhost: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4F7087',
    backgroundColor: 'rgba(22, 51, 72, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  launchBtnGhostText: {
    color: '#D9ECF8',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
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
  rankGroup: { marginBottom: 8 },
  rankTitle: { color: theme.colors.accent, fontFamily: theme.fonts.title, marginBottom: 4, fontSize: 12, textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(157,185,203,0.2)', paddingVertical: 5 },
  rankLine: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 12 },
  rankScore: { color: theme.colors.accent2, fontFamily: theme.fonts.title, fontSize: 12 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 19, 0.84)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F2433',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#375E76',
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 16 },
  modalLabel: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#456880',
    backgroundColor: '#173245',
  },
  choiceBtnWide: {
    minHeight: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#456880',
    backgroundColor: '#173245',
    paddingHorizontal: 10,
  },
  choiceBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  choiceText: { color: '#D8EBFA', fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  choiceTextActive: { color: '#3A2500' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#D8EBFA', fontFamily: theme.fonts.body, fontSize: 12 },
  feedback: { color: theme.colors.warning, fontFamily: theme.fonts.body, fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: '#29495F' },
  modalBtnText: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 12 },
  modalBtnGhostText: { color: '#EAF5FF' },
});
