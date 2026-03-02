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

function formatTime(iso) {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [feedItems, setFeedItems] = useState([]);
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const loadMain = useCallback(async () => {
    setError('');
    const [feedOut, crewOut, suggestionsOut] = await Promise.all([
      api.communityFeed(token, 30),
      api.crew(token, user.city ?? ''),
      api.matchmakingSuggestions(token, { city: user.city ?? 'Lyon', limit: 6 }),
    ]);

    setFeedItems(Array.isArray(feedOut?.items) ? feedOut.items : []);
    setFriends(Array.isArray(crewOut?.friends) ? crewOut.friends : []);
    setSuggestions(Array.isArray(suggestionsOut?.suggestions) ? suggestionsOut.suggestions : []);
  }, [token, user.city]);

  useEffect(() => {
    loadMain().catch((e) => setError(e.message ?? 'Erreur de chargement'));
  }, [loadMain]);

  async function onRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await loadMain();
    } catch (e) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setRefreshing(false);
    }
  }

  async function proposeMatch(playerId) {
    try {
      await api.proposeMatchmaking(token, { targetUserId: playerId });
      await loadMain();
    } catch (e) {
      setError(e.message ?? 'Erreur proposition');
    }
  }

  function openPlay() {
    navigation.getParent()?.navigate('PlayTab', { screen: 'PlaySetup' });
  }

  function openRanking() {
    navigation.getParent()?.navigate('RankingTab', { screen: 'RankingMain' });
  }

  const topFeed = useMemo(() => feedItems.slice(0, 20), [feedItems]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}> 
      <CourtPattern variant="community" />
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 24) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
      >
        <Text style={[styles.title, { color: palette.text }]}>{t('community.title', undefined, 'Communaute')}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Feed local simple, comme un fil insta du padel.</Text>

        <Card>
          <View style={styles.quickRow}>
            <Pressable style={[styles.quickBtn, { backgroundColor: palette.accent }]} onPress={openPlay}>
              <Text style={[styles.quickBtnText, { color: palette.accentText }]}>Lancer un match</Text>
            </Pressable>
            <Pressable style={[styles.quickBtn, { borderColor: palette.line, backgroundColor: palette.bgAlt }]} onPress={openRanking}>
              <Text style={[styles.quickBtnText, { color: palette.text }]}>Voir classement</Text>
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>Joueurs dans ton reseau: {friends.length}</Text>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Nouveautes du terrain</Text>
          <View style={styles.feedWrap}>
            {topFeed.map((item) => (
              <View key={item.id} style={[styles.feedCard, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}> 
                <View style={styles.feedTop}>
                  <Text style={[styles.feedScore, { color: palette.text }]}>{item.score ?? 'Match termine'}</Text>
                  <Text style={[styles.feedTime, { color: palette.textSecondary }]}>{formatTime(item.createdAt)}</Text>
                </View>
                <Text style={[styles.feedPlayers, { color: palette.textSecondary }]}>
                  {(item.players ?? []).map((entry) => entry.displayName).join(' · ') || 'Joueurs non renseignes'}
                </Text>
                <View style={styles.feedTags}>
                  {!!item.stressTag ? (
                    <View style={[styles.tag, { borderColor: palette.line, backgroundColor: palette.cardStrong }]}> 
                      <Text style={[styles.tagText, { color: palette.textSecondary }]}>{String(item.stressTag)}</Text>
                    </View>
                  ) : null}
                  {item.isKeyMatch ? (
                    <View style={[styles.tag, { borderColor: palette.warning, backgroundColor: palette.accentMuted }]}> 
                      <Text style={[styles.tagText, { color: palette.warning }]}>Match cle</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
            {topFeed.length === 0 ? <Text style={[styles.meta, { color: palette.textSecondary }]}>Aucune activite pour l instant.</Text> : null}
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Trouve ton prochain adversaire</Text>
          {suggestions.map((item) => (
            <View key={item.userId} style={[styles.suggestionRow, { borderBottomColor: palette.line }]}> 
              <View>
                <Text style={[styles.suggestionName, { color: palette.text }]}>{item.displayName}</Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>Compatibilite {item.compatibilityScore ?? 0}%</Text>
              </View>
              <Pressable style={[styles.proposeBtn, { backgroundColor: palette.accent }]} onPress={() => proposeMatch(item.userId)}>
                <Text style={[styles.proposeBtnText, { color: palette.accentText }]}>Defier</Text>
              </Pressable>
            </View>
          ))}
          {suggestions.length === 0 ? <Text style={[styles.meta, { color: palette.textSecondary }]}>Aucune suggestion disponible.</Text> : null}
        </Card>

        {!!error ? (
          <Card>
            <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
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
  title: { fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 36 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBtnText: { fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionTitle: { fontFamily: theme.fonts.title, fontSize: 15, marginBottom: 8 },
  meta: { marginTop: 8, fontFamily: theme.fonts.body, fontSize: 12 },
  feedWrap: { gap: 8 },
  feedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  feedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedScore: { fontFamily: theme.fonts.title, fontSize: 14 },
  feedTime: { fontFamily: theme.fonts.body, fontSize: 11 },
  feedPlayers: { fontFamily: theme.fonts.body, fontSize: 12 },
  feedTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  tagText: { fontFamily: theme.fonts.title, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  suggestionRow: {
    minHeight: 54,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  suggestionName: { fontFamily: theme.fonts.title, fontSize: 13 },
  proposeBtn: {
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proposeBtnText: { fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  error: { fontFamily: theme.fonts.body, fontSize: 12 },
});