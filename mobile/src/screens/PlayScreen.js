import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

function MatchCard({ match, onValidate }) {
  const label = `${match.sets?.[0]?.a ?? 0}-${match.sets?.[0]?.b ?? 0} / ${match.sets?.[1]?.a ?? 0}-${match.sets?.[1]?.b ?? 0}`;
  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchTitle}>Match {match.id.slice(-6)}</Text>
      <Text style={styles.meta}>Score: {label}</Text>
      <Text style={styles.meta}>Statut: {match.status}</Text>
      <Text style={styles.meta}>Validation: {match.validation?.accepted ?? 0} ok / {match.validation?.rejected ?? 0} non</Text>
      {match.canValidate ? (
        <View style={styles.row}>
          <Pressable style={[styles.actionBtn, styles.accept]} onPress={() => onValidate(match.id, true)}>
            <Text style={styles.actionText}>Valider</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.reject]} onPress={() => onValidate(match.id, false)}>
            <Text style={[styles.actionText, styles.rejectText]}>Refuser</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function PlayScreen() {
  const { token, user } = useSession();
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [score1, setScore1] = useState('6-4');
  const [score2, setScore2] = useState('6-3');
  const [goldenA, setGoldenA] = useState('2');
  const [goldenB, setGoldenB] = useState('1');
  const [totalCost, setTotalCost] = useState('48');
  const [feedback, setFeedback] = useState('');
  const [matches, setMatches] = useState([]);

  const selectablePlayers = useMemo(
    () => players.filter((p) => p.id !== user.id),
    [players, user.id]
  );

  async function refresh() {
    const [playersOut, myMatches] = await Promise.all([
      api.listPlayers(token),
      api.listMyMatches(token),
    ]);
    setPlayers(playersOut);
    setMatches(myMatches);
  }

  useEffect(() => {
    refresh().catch((e) => setFeedback(e.message));
  }, []);

  function toggle(playerId) {
    setSelected((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, playerId];
    });
  }

  function parseSet(raw) {
    const [a, b] = raw.split('-').map((v) => Number(v.trim()));
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error('Format set invalide. Exemple: 6-4');
    }
    return { a, b };
  }

  async function create() {
    setFeedback('');
    try {
      if (selected.length !== 3) {
        throw new Error('Selectionne exactement 3 joueurs');
      }

      const [teamA2, teamB1, teamB2] = selected;
      const out = await api.createMatch(token, {
        teamA: [user.id, teamA2],
        teamB: [teamB1, teamB2],
        sets: [parseSet(score1), parseSet(score2)],
        goldenPoints: { teamA: Number(goldenA), teamB: Number(goldenB) },
        totalCostEur: Number(totalCost),
        clubName: 'Club local',
      });
      setFeedback(`Match ${out.id.slice(-6)} cree. Validation croisee en cours.`);
      setSelected([]);
      await refresh();
    } catch (e) {
      setFeedback(e.message);
    }
  }

  async function validate(matchId, accepted) {
    setFeedback('');
    try {
      await api.validateMatch(token, matchId, accepted);
      setFeedback(accepted ? 'Score valide.' : 'Score refuse.');
      await refresh();
    } catch (e) {
      setFeedback(e.message);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MATCH CONTROL</Text>
        <Text style={styles.h1}>Mode Competition</Text>
      </View>

      <Card elevated>
        <Text style={styles.sectionTitle}>1) Choisis 3 joueurs</Text>
        <Text style={styles.meta}>Le 1er complete ton equipe. Les 2 suivants sont l equipe adverse.</Text>
        <View style={styles.wrap}>
          {selectablePlayers.map((p) => {
            const active = selected.includes(p.id);
            return (
              <Pressable
                key={p.id}
                style={[styles.playerChip, active && styles.playerChipActive]}
                onPress={() => toggle(p.id)}
              >
                <Text style={[styles.playerText, active && styles.playerTextActive]}>{p.displayName} ({p.rating})</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.meta}>Selection: {selected.length}/3</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>2) Score officiel</Text>
        <Text style={styles.label}>Set 1</Text>
        <TextInput style={styles.input} value={score1} onChangeText={setScore1} />
        <Text style={styles.label}>Set 2</Text>
        <TextInput style={styles.input} value={score2} onChangeText={setScore2} />
        <Text style={styles.label}>Punto de Oro A/B</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} value={goldenA} onChangeText={setGoldenA} keyboardType="numeric" />
          <TextInput style={[styles.input, styles.half]} value={goldenB} onChangeText={setGoldenB} keyboardType="numeric" />
        </View>
        <Text style={styles.label}>Cout total terrain (EUR)</Text>
        <TextInput style={styles.input} value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" />
      </Card>

      <Pressable style={styles.cta} onPress={create}>
        <Text style={styles.ctaText}>Generer match</Text>
      </Pressable>

      {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

      <Card>
        <Text style={styles.sectionTitle}>Matchs recents</Text>
        {matches.length === 0 ? (
          <Text style={styles.meta}>Aucun match</Text>
        ) : (
          matches.slice(0, 8).map((match) => (
            <MatchCard key={match.id} match={match} onValidate={validate} />
          ))
        )}
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
    fontSize: 40,
    lineHeight: 42,
    fontFamily: theme.fonts.display,
  },
  sectionTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, marginBottom: 8, fontSize: 16 },
  label: { color: theme.colors.muted, marginBottom: 4, marginTop: 4, fontFamily: theme.fonts.body },
  meta: { color: theme.colors.muted, marginBottom: 4, fontFamily: theme.fonts.body },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    color: theme.colors.text,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.bgAlt,
    fontFamily: theme.fonts.body,
  },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  cta: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  feedback: { color: theme.colors.warning, fontFamily: theme.fonts.title },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  playerChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.chip,
  },
  playerChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  playerText: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 12 },
  playerTextActive: { color: '#3A2500' },
  matchCard: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.bgAlt,
  },
  matchTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, marginBottom: 4 },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  accept: { backgroundColor: theme.colors.accent },
  reject: { backgroundColor: theme.colors.danger },
  actionText: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 12 },
  rejectText: { color: '#3D0505' },
});
