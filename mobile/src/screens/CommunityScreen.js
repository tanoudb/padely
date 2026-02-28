import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

export function CommunityScreen() {
  const { token } = useSession();
  const [city, setCity] = useState('Lyon');
  const [players, setPlayers] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [listings, setListings] = useState([]);
  const [newListing, setNewListing] = useState('Raquette quasi neuve');

  async function refresh() {
    const [ps, lb, ls] = await Promise.all([
      api.listPlayers(token),
      api.leaderboard(token, city),
      api.listings(token, city),
    ]);
    setPlayers(ps);
    setLeaderboard(lb.rows ?? []);
    setListings(ls);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, [city]);

  async function postListing() {
    await api.createListing(token, {
      title: newListing,
      priceEur: 120,
      city,
      category: 'racket',
    });
    await refresh();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COMMUNITY ENGINE</Text>
        <Text style={styles.h1}>Trouve ton crew</Text>
      </View>

      <Card elevated>
        <Text style={styles.label}>Ville active</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={theme.colors.muted} />
      </Card>

      <Card>
        <Text style={styles.section}>Top 10 {city}</Text>
        {leaderboard.length === 0 ? <Text style={styles.row}>Aucun classement</Text> : leaderboard.slice(0, 5).map((row) => (
          <View style={styles.rankRow} key={row.userId}>
            <Text style={styles.rankText}>#{row.rank} {row.displayName}</Text>
            <Text style={styles.rankScore}>{row.rating}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Matchmaking express</Text>
        <Text style={styles.sub}>Joueurs proches de ton niveau</Text>
        {players.slice(0, 6).map((p) => (
          <View style={styles.playerRow} key={p.id}>
            <Text style={styles.playerName}>{p.displayName}</Text>
            <Text style={styles.playerRating}>{p.rating}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Marketplace locale</Text>
        <TextInput style={styles.input} value={newListing} onChangeText={setNewListing} placeholderTextColor={theme.colors.muted} />
        <Pressable style={styles.btn} onPress={postListing}>
          <Text style={styles.btnLabel}>Publier annonce</Text>
        </Pressable>
        {listings.slice(0, 4).map((item) => (
          <View style={styles.marketRow} key={item.id}>
            <Text style={styles.marketTitle}>{item.title}</Text>
            <Text style={styles.marketPrice}>{item.priceEur} EUR</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  eyebrow: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    letterSpacing: 1,
    fontSize: 11,
  },
  h1: {
    color: theme.colors.text,
    fontSize: 38,
    lineHeight: 40,
    fontFamily: theme.fonts.display,
  },
  section: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    marginBottom: 8,
    fontSize: 16,
  },
  sub: {
    color: theme.colors.muted,
    marginBottom: 10,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  label: { color: theme.colors.muted, marginBottom: 6, fontFamily: theme.fonts.body },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgAlt,
    fontFamily: theme.fonts.body,
  },
  row: { color: theme.colors.muted, marginBottom: 4, fontFamily: theme.fonts.body },
  btn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  btnLabel: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    paddingVertical: 6,
  },
  rankText: { color: theme.colors.text, fontFamily: theme.fonts.title },
  rankScore: { color: theme.colors.accent, fontFamily: theme.fonts.mono },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  playerName: { color: theme.colors.text, fontFamily: theme.fonts.body },
  playerRating: { color: theme.colors.accent2, fontFamily: theme.fonts.mono },
  marketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(157, 185, 203, 0.12)',
  },
  marketTitle: { color: theme.colors.text, fontFamily: theme.fonts.body },
  marketPrice: { color: theme.colors.warning, fontFamily: theme.fonts.title },
});
