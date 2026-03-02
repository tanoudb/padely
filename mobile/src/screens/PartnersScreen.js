import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

export function PartnersScreen() {
  const { token, user } = useSession();
  const { palette } = useUi();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [duos, setDuos] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    Promise.all([
      api.duoStats(token, user.id),
      api.listPlayers(token),
    ]).then(([duoData, playerData]) => {
      setDuos(Array.isArray(duoData?.rows) ? duoData.rows : []);
      setPlayers(playerData);
    }).catch(() => {});
  }, [token, user.id]);

  const playersById = useMemo(() => {
    const map = new Map();
    for (const player of players) {
      map.set(player.id, player);
    }
    return map;
  }, [players]);

  const sorted = [...duos].sort((a, b) => {
    if (b.winRate !== a.winRate) {
      return b.winRate - a.winRate;
    }
    return b.matches - a.matches;
  });

  const best = sorted[0] ?? null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PARTENAIRES</Text>
        <Text style={styles.h1}>Synergie de paire</Text>
      </View>

      <Card elevated>
        <Text style={styles.cardTitle}>Meilleur partenaire actuel</Text>
        {best ? (
          <>
            <Text style={styles.bestName}>{playersById.get(best.partnerId)?.displayName ?? best.partnerId}</Text>
            <Text style={styles.bestMeta}>Taux de victoire: {best.winRate}%</Text>
            <Text style={styles.bestMeta}>Distance moyenne: {best.averageDistanceKm} km/match</Text>
            <Text style={styles.bestMeta}>Matchs ensemble: {best.matches}</Text>
          </>
        ) : (
          <Text style={styles.empty}>Joue quelques matchs pour voir tes synergies.</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Tous les partenaires</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>Aucune donnee partenaire pour le moment.</Text>
        ) : (
          sorted.map((item) => {
            const name = playersById.get(item.partnerId)?.displayName ?? item.partnerId;
            return (
              <View key={item.partnerId} style={styles.row}>
                <View>
                  <Text style={styles.partnerName}>{name}</Text>
                  <Text style={styles.meta}>{item.matches} matchs · {item.totalDistanceKm} km</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.winRate}>{item.winRate}%</Text>
                  <Text style={styles.meta}>moy. {item.averageDistanceKm} km</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 16, gap: 12, paddingBottom: 24 },
    header: { marginBottom: 4 },
    eyebrow: {
      color: palette.accent2,
      fontFamily: theme.fonts.mono,
      letterSpacing: 1,
      fontSize: 11,
    },
    h1: {
      color: palette.text,
      fontSize: 40,
      lineHeight: 42,
      fontFamily: theme.fonts.display,
    },
    cardTitle: {
      color: palette.text,
      fontFamily: theme.fonts.title,
      marginBottom: 10,
      fontSize: 16,
    },
    bestName: {
      color: palette.accent,
      fontFamily: theme.fonts.display,
      fontSize: 36,
      lineHeight: 38,
    },
    bestMeta: {
      color: palette.muted,
      fontFamily: theme.fonts.body,
      marginTop: 4,
    },
    empty: {
      color: palette.muted,
      fontFamily: theme.fonts.body,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(157, 185, 203, 0.15)',
      paddingVertical: 10,
    },
    partnerName: {
      color: palette.text,
      fontFamily: theme.fonts.title,
      fontSize: 15,
    },
    meta: {
      color: palette.muted,
      fontFamily: theme.fonts.body,
      fontSize: 12,
    },
    right: {
      alignItems: 'flex-end',
    },
    winRate: {
      color: palette.accent2,
      fontFamily: theme.fonts.title,
      fontSize: 20,
    },
  });
}
