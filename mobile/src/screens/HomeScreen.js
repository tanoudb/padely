import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { CourtPattern } from '../components/CourtPattern';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function formatMatchDate(iso) {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) return '--';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDelta(value) {
  const number = Number(value ?? 0);
  if (!number) return '0';
  return number > 0 ? `+${number}` : String(number);
}

export function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [dashboard, setDashboard] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadHome = useCallback(async () => {
    setLoadError('');
    const [dash, matchesOut] = await Promise.all([
      api.dashboard(token, user.id, 'all'),
      api.listMyMatches(token),
    ]);
    setDashboard(dash);
    setRecentMatches(Array.isArray(matchesOut) ? matchesOut : []);
  }, [token, user.id]);

  useEffect(() => {
    loadHome().catch((e) => setLoadError(e.message ?? 'Impossible de charger les donnees'));
  }, [loadHome]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadHome();
    } catch (e) {
      setLoadError(e.message ?? 'Impossible de charger les donnees');
    } finally {
      setRefreshing(false);
    }
  }

  function openPlay() {
    navigation.getParent()?.navigate('PlayTab', { screen: 'PlaySetup' });
  }

  function openCommunity() {
    navigation.getParent()?.navigate('CommunityTab', { screen: 'CommunityMain' });
  }

  function openRanking() {
    navigation.getParent()?.navigate('RankingTab', { screen: 'RankingMain' });
  }

  const rating = Number(dashboard?.rating ?? user?.rating ?? 1200);
  const pir = Number(dashboard?.pir ?? user?.pir ?? 50);
  const wins = Number(dashboard?.wins ?? 0);
  const totalMatches = Number(dashboard?.matches ?? 0);
  const losses = Math.max(0, totalMatches - wins);
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const lastDelta = Number(dashboard?.progression?.at?.(-1)?.delta ?? 0);

  const topMatches = useMemo(() => recentMatches.slice(0, 5), [recentMatches]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}> 
      <CourtPattern variant="home" />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
      >
        <Text style={[styles.title, { color: palette.text }]}>{t('home.hello', { name: user.displayName })}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {t('home.subtitle', undefined, 'Cockpit technique clair: stats, classement, match.')}
        </Text>

        <Card elevated>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Donnees techniques</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>PIR</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>{Math.round(pir)}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Rating</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>{Math.round(rating)}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>W/L</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>{wins}/{losses}</Text>
            </View>
            <View style={[styles.statBox, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Winrate</Text>
              <Text style={[styles.statValue, { color: palette.text }]}>{winRate}%</Text>
            </View>
          </View>
          <View style={[styles.deltaRow, { borderTopColor: palette.line }]}> 
            <Text style={[styles.deltaLabel, { color: palette.textSecondary }]}>Derniere variation PIR</Text>
            <Text style={[styles.deltaValue, { color: lastDelta >= 0 ? palette.accent : palette.danger }]}>{formatDelta(lastDelta)}</Text>
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Actions rapides</Text>
          <View style={styles.actionsCol}>
            <Pressable style={[styles.cta, { backgroundColor: palette.accent }]} onPress={openPlay}>
              <Text style={[styles.ctaText, { color: palette.accentText }]}>{t('home.launchRanked', undefined, 'Lancer un match classe')}</Text>
            </Pressable>
            <View style={styles.actionsRow}>
              <Pressable style={[styles.secondaryBtn, { borderColor: palette.line, backgroundColor: palette.bgAlt }]} onPress={openCommunity}>
                <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Communaute</Text>
              </Pressable>
              <Pressable style={[styles.secondaryBtn, { borderColor: palette.line, backgroundColor: palette.bgAlt }]} onPress={openRanking}>
                <Text style={[styles.secondaryBtnText, { color: palette.text }]}>Classement</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Derniers matchs</Text>
          {topMatches.map((match) => (
            <View key={match.id} style={[styles.matchRow, { borderBottomColor: palette.line }]}> 
              <View>
                <Text style={[styles.matchScore, { color: palette.text }]}>{match.score ?? 'Score en attente'}</Text>
                <Text style={[styles.matchMeta, { color: palette.textSecondary }]}>{formatMatchDate(match.validatedAt ?? match.createdAt)}</Text>
              </View>
              <Text style={[styles.matchStatus, { color: palette.textSecondary }]}>{match.status ?? 'pending'}</Text>
            </View>
          ))}
          {topMatches.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Aucun match enregistre pour l instant.</Text>
          ) : null}
        </Card>

        {!!loadError ? (
          <Card>
            <Text style={[styles.error, { color: palette.danger }]}>{loadError}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: { flex: 1 },
  content: { paddingHorizontal: 14, paddingBottom: 28, gap: 12 },
  title: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 34 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13 },
  sectionTitle: { fontFamily: theme.fonts.title, fontSize: 15, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: {
    width: '48%',
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 12 },
  statValue: { fontFamily: theme.fonts.title, fontSize: 20 },
  deltaRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaLabel: { fontFamily: theme.fonts.body, fontSize: 12 },
  deltaValue: { fontFamily: theme.fonts.title, fontSize: 14 },
  actionsCol: { gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  cta: {
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },
  secondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  matchRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchScore: { fontFamily: theme.fonts.title, fontSize: 13 },
  matchMeta: { marginTop: 3, fontFamily: theme.fonts.body, fontSize: 12 },
  matchStatus: { fontFamily: theme.fonts.body, fontSize: 12, textTransform: 'uppercase' },
  emptyText: { fontFamily: theme.fonts.body, fontSize: 12 },
  error: { fontFamily: theme.fonts.body, fontSize: 12 },
});