import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

export function RankingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [period, setPeriod] = useState('season');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const loadBoard = useCallback(async () => {
    setError('');
    const out = await api.leaderboardByPeriod(token, user.city ?? 'Lyon', period);
    setRows(Array.isArray(out?.rows) ? out.rows : []);
  }, [token, user.city, period]);

  useEffect(() => {
    loadBoard().catch((e) => setError(e.message ?? 'Classement indisponible'));
  }, [loadBoard]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadBoard();
    } catch (e) {
      setError(e.message ?? 'Classement indisponible');
    } finally {
      setRefreshing(false);
    }
  }

  const topRows = useMemo(() => rows.slice(0, 30), [rows]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: palette.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 24) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <Text style={[styles.title, { color: palette.text }]}>Classement</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Ville: {user.city ?? 'Lyon'}
      </Text>

      <Card>
        <View style={styles.periodRow}>
          <Pressable
            style={[styles.periodBtn, { borderColor: period === 'season' ? palette.accent : palette.line, backgroundColor: period === 'season' ? palette.accentMuted : palette.bgAlt }]}
            onPress={() => setPeriod('season')}
          >
            <Text style={[styles.periodBtnText, { color: period === 'season' ? palette.accent : palette.textSecondary }]}>Saison</Text>
          </Pressable>
          <Pressable
            style={[styles.periodBtn, { borderColor: period === 'all' ? palette.accent : palette.line, backgroundColor: period === 'all' ? palette.accentMuted : palette.bgAlt }]}
            onPress={() => setPeriod('all')}
          >
            <Text style={[styles.periodBtnText, { color: period === 'all' ? palette.accent : palette.textSecondary }]}>Global</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.rowsWrap}>
        {topRows.map((row) => (
          <LeaderboardRow
            key={row.userId}
            row={row}
            podium={Number(row.rank) <= 3}
            isCurrentUser={row.userId === user.id}
            currentUserLabel={t('home.you', undefined, 'Toi')}
            onPress={() => navigation.navigate('PlayerProfile', { playerId: row.userId, playerName: row.displayName })}
          />
        ))}
      </View>

      {topRows.length === 0 ? (
        <Card>
          <Text style={[styles.empty, { color: palette.textSecondary }]}>Aucune donnee de classement disponible.</Text>
        </Card>
      ) : null}

      {!!error ? (
        <Card>
          <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 14, paddingBottom: 28, gap: 12 },
  title: { fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 36 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodBtnText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowsWrap: { gap: 8 },
  empty: { fontFamily: theme.fonts.body, fontSize: 12 },
  error: { fontFamily: theme.fonts.body, fontSize: 12 },
});