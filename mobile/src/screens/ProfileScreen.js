import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

function rankFromRating(rating) {
  if (rating >= 2100) return 'Or I';
  if (rating >= 1800) return 'Argent II';
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

function StatLine({ label, value }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { token, user } = useSession();
  const [dashboard, setDashboard] = useState(null);
  const [duos, setDuos] = useState([]);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('profile');

  useEffect(() => {
    Promise.all([
      api.dashboard(token, user.id),
      api.duoStats(token, user.id),
      api.listPlayers(token),
    ]).then(([db, duoStats, playerList]) => {
      setDashboard(db);
      setDuos(duoStats);
      setPlayers(playerList);
    }).catch(() => {});
  }, [token, user.id]);

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
  const initials = (user.displayName ?? 'P').slice(0, 2).toUpperCase();

  if (view === 'partners') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => setView('profile')}>
            <Text style={styles.backBtnText}>Retour profil</Text>
          </Pressable>
          <Text style={styles.h1}>Partenaires</Text>
        </View>

        <Card elevated>
          <Text style={styles.cardTitle}>Meilleure synergie</Text>
          {bestDuo ? (
            <>
              <Text style={styles.bestName}>{playersById.get(bestDuo.partnerId)?.displayName ?? bestDuo.partnerId}</Text>
              <Text style={styles.meta}>Taux de victoire: {bestDuo.winRate}%</Text>
              <Text style={styles.meta}>Distance moyenne: {bestDuo.averageDistanceKm} km</Text>
              <Text style={styles.meta}>Matchs joues ensemble: {bestDuo.matches}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Aucune paire pour le moment.</Text>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Toutes les paires</Text>
          {sortedDuos.length === 0 ? (
            <Text style={styles.meta}>Commence quelques matchs pour remplir cette section.</Text>
          ) : sortedDuos.map((item) => (
            <View key={item.partnerId} style={styles.duoRow}>
              <View>
                <Text style={styles.duoName}>{playersById.get(item.partnerId)?.displayName ?? item.partnerId}</Text>
                <Text style={styles.meta}>{item.matches} matchs • {item.totalDistanceKm} km</Text>
              </View>
              <Text style={styles.duoRate}>{item.winRate}%</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ESPACE PERSONNEL</Text>
        <Text style={styles.h1}>Profil joueur</Text>
      </View>

      <Card elevated style={styles.identityCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.playerName}>{user.displayName}</Text>
          <Text style={styles.rankText}>{rankFromRating(rating)}</Text>
          <Text style={styles.meta}>PIR {Math.round(pir)} • Classement {Math.round(rating)}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Bilan global</Text>
        <StatLine label="Victoires" value={dashboard?.wins ?? 0} />
        <StatLine label="Defaites" value={dashboard?.losses ?? 0} />
        <StatLine label="Distance totale" value={`${dashboard?.totalDistanceKm ?? 0} km`} />
        <StatLine label="Distance moyenne" value={`${dashboard?.averageDistanceKm ?? 0} km/match`} />
        <StatLine label="Constance" value={`${dashboard?.consistencyScore ?? 0}/100`} />
        <StatLine label="Regularite" value={`${dashboard?.regularityScore ?? 0}/100`} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Donnees biometrie</Text>
        <StatLine label="Cardio moyen" value={`${dashboard?.averageHeartRate ?? 0} bpm`} />
        <StatLine label="Oxygene moyen" value={`${dashboard?.averageOxygen ?? 0}%`} />
        <StatLine label="Calories" value={dashboard?.calories ?? 0} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Confidentialite</Text>
        <Text style={styles.meta}>Profil public: {user.privacy?.publicProfile ? 'oui' : 'non'}</Text>
        <Text style={styles.meta}>Matchs invites visibles: {user.privacy?.showGuestMatches ? 'oui' : 'non'}</Text>
        <Text style={styles.meta}>Stats sante visibles: {user.privacy?.showHealthStats ? 'oui' : 'non'}</Text>
      </Card>

      <Pressable style={styles.cta} onPress={() => setView('partners')}>
        <Text style={styles.ctaText}>Voir stats partenaires</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  headerRow: { marginBottom: 4, gap: 8 },
  eyebrow: { color: theme.colors.accent2, fontFamily: theme.fonts.mono, letterSpacing: 1, fontSize: 11 },
  h1: { color: theme.colors.text, fontSize: 38, lineHeight: 40, fontFamily: theme.fonts.display },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#305C78',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7CA7C3',
  },
  avatarText: { color: '#F5FBFF', fontFamily: theme.fonts.title, fontSize: 24 },
  identityInfo: { flex: 1 },
  playerName: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 24 },
  rankText: { color: theme.colors.accent, fontFamily: theme.fonts.title, fontSize: 16 },
  cardTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 16, marginBottom: 8 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    paddingVertical: 7,
  },
  label: { color: theme.colors.muted, fontFamily: theme.fonts.body },
  value: { color: theme.colors.text, fontFamily: theme.fonts.title },
  meta: { color: theme.colors.muted, fontFamily: theme.fonts.body, marginTop: 2 },
  cta: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: '#2D566D',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  backBtnText: { color: '#E9F6FF', fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  bestName: { color: theme.colors.accent, fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 34 },
  duoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    paddingVertical: 9,
  },
  duoName: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 14 },
  duoRate: { color: theme.colors.accent2, fontFamily: theme.fonts.title, fontSize: 18 },
});
