import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';
import {
  addPoint,
  createScoreState,
  getCurrentServer,
  getDisplayPoints,
  resetScore,
  scoreStateToSets,
  setInitialServer,
  setPuntoDeOro,
  undoPoint,
} from '../utils/scoring';

function MatchCard({ match, onValidate }) {
  const label = match.sets.map((set) => `${set.a}-${set.b}`).join(' / ');
  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchTitle}>Match {match.id.slice(-6)}</Text>
      <Text style={styles.meta}>Score: {label || 'N/A'}</Text>
      <Text style={styles.meta}>Statut: {match.status}</Text>
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

function Board({ score, setScore, landscape }) {
  const displayPoints = getDisplayPoints(score);
  const currentServer = getCurrentServer(score);

  return (
    <>
      <View style={[styles.board, landscape && styles.boardLandscape]}>
        <Pressable style={[styles.side, styles.redSide]} onPress={() => setScore((prev) => addPoint(prev, 'a'))}>
          <Text style={styles.sideTitle}>Equipe Rouge {currentServer === 'a' ? '🎾' : ''}</Text>
          <Text style={styles.bigPoint}>{displayPoints.a}</Text>
          <Text style={styles.sideMeta}>Jeux: {score.currentSet.a}</Text>
          <Text style={styles.sideHint}>Touchez pour +1 point</Text>
        </Pressable>

        <Pressable style={[styles.side, styles.blueSide]} onPress={() => setScore((prev) => addPoint(prev, 'b'))}>
          <Text style={styles.sideTitle}>Equipe Bleue {currentServer === 'b' ? '🎾' : ''}</Text>
          <Text style={styles.bigPoint}>{displayPoints.b}</Text>
          <Text style={styles.sideMeta}>Jeux: {score.currentSet.b}</Text>
          <Text style={styles.sideHint}>Touchez pour +1 point</Text>
        </Pressable>
      </View>

      <Text style={styles.meta}>
        {displayPoints.tieBreak ? 'Tie-break actif' : 'Jeu standard'} · Sets: {score.sets.map((set) => `${set.a}-${set.b}`).join(' / ') || 'aucun'}
      </Text>
      {!!score.lastEvent && <Text style={styles.meta}>{score.lastEvent}</Text>}
      {score.sideChangeAlert ? <Text style={styles.sideChange}>Changement de cote recommande (jeu impair).</Text> : null}

      <View style={styles.row}>
        <Pressable style={[styles.actionBtn, styles.undoBtn]} onPress={() => setScore((prev) => undoPoint(prev))}>
          <Text style={styles.actionText}>Annuler dernier point</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.resetBtn]} onPress={() => setScore(resetScore(score.config))}>
          <Text style={styles.actionText}>Reinitialiser score</Text>
        </Pressable>
      </View>
    </>
  );
}

function victoryTone(sets, winner) {
  const totalGamesWinner = sets.reduce((sum, set) => sum + (winner === 'a' ? set.a : set.b), 0);
  const totalGamesLoser = sets.reduce((sum, set) => sum + (winner === 'a' ? set.b : set.a), 0);
  const gap = totalGamesWinner - totalGamesLoser;

  if (gap >= 8) {
    return {
      title: 'VICTOIRE ECRASANTE',
      subtitle: 'Domination totale du match',
      color: '#F4D35E',
    };
  }

  if (gap >= 4) {
    return {
      title: 'VICTOIRE MAITRISEE',
      subtitle: 'Match controle du debut a la fin',
      color: '#00D1B2',
    };
  }

  return {
    title: 'VICTOIRE ACCROCHEE',
    subtitle: 'Mental solide dans les moments cles',
    color: '#FFAD5A',
  };
}

export function PlayScreen() {
  const { token, user } = useSession();
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [totalCost, setTotalCost] = useState('48');
  const [feedback, setFeedback] = useState('');
  const [matches, setMatches] = useState([]);
  const [score, setScore] = useState(createScoreState({ puntoDeOro: false, thirdSetTieBreak: false, setsToWin: 2 }));
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [savedMatchId, setSavedMatchId] = useState(null);

  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const forcedLandscapeStyle = landscape
    ? null
    : {
      width: Math.max(280, height - 32),
      height: Math.max(220, width - 32),
      transform: [{ rotate: '90deg' }],
    };
  const cinematicAnim = useRef(new Animated.Value(0)).current;

  const selectablePlayers = useMemo(
    () => players.filter((p) => p.id !== user.id),
    [players, user.id]
  );

  const setsPayload = useMemo(() => scoreStateToSets(score), [score]);
  const winnerTone = useMemo(() => {
    if (!score.winner || setsPayload.length === 0) {
      return null;
    }
    return victoryTone(setsPayload, score.winner);
  }, [score.winner, setsPayload]);

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

  useEffect(() => {
    if (!score.winner) {
      cinematicAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(cinematicAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cinematicAnim, {
        toValue: 0.9,
        duration: 500,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [score.winner, cinematicAnim]);

  useEffect(() => {
    async function autoSave() {
      if (!score.winner || savingAuto || savedMatchId) {
        return;
      }
      if (selected.length !== 3) {
        setFeedback('Match termine: selectionne les 3 joueurs pour enregistrer automatiquement.');
        return;
      }

      try {
        setSavingAuto(true);
        const [teamA2, teamB1, teamB2] = selected;
        const out = await api.createMatch(token, {
          teamA: [user.id, teamA2],
          teamB: [teamB1, teamB2],
          sets: setsPayload,
          goldenPoints: { teamA: 0, teamB: 0 },
          validationMode: 'rapide',
          totalCostEur: Number(totalCost),
          clubName: 'Club local',
        });

        setSavedMatchId(out.id);
        setFeedback(`Match ${out.id.slice(-6)} enregistre automatiquement.`);
        await refresh();
      } catch (e) {
        setFeedback(`Erreur enregistrement auto: ${e.message}`);
      } finally {
        setSavingAuto(false);
      }
    }

    autoSave();
  }, [score.winner, selected, setsPayload, totalCost, token, user.id, savingAuto, savedMatchId]);

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

  async function createManual() {
    setFeedback('');
    try {
      if (selected.length !== 3) {
        throw new Error('Selectionne exactement 3 joueurs');
      }

      if (setsPayload.length === 0) {
        throw new Error('Ajoute au moins un jeu avant d enregistrer le match');
      }

      const [teamA2, teamB1, teamB2] = selected;
      const out = await api.createMatch(token, {
        teamA: [user.id, teamA2],
        teamB: [teamB1, teamB2],
        sets: setsPayload,
        goldenPoints: { teamA: 0, teamB: 0 },
        validationMode: 'rapide',
        totalCostEur: Number(totalCost),
        clubName: 'Club local',
      });

      setFeedback(`Match ${out.id.slice(-6)} cree.`);
      setSavedMatchId(out.id);
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

  function closeVictory() {
    setScore(resetScore(score.config));
    setSavedMatchId(null);
    setFullScreenMode(false);
    setFeedback('Nouveau match pret.');
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TABLEAU DE SCORE</Text>
          <Text style={styles.h1}>Match en direct</Text>
        </View>

        <Card elevated>
          <Text style={styles.sectionTitle}>1) Choisis 3 joueurs</Text>
          <Text style={styles.meta}>Le premier complete ton equipe. Les deux autres sont l equipe bleue.</Text>
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
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Punto de Oro</Text>
            <Switch
              value={score.config.puntoDeOro}
              onValueChange={(value) => setScore((prev) => setPuntoDeOro(prev, value))}
              trackColor={{ false: '#29495F', true: '#C89D20' }}
              thumbColor={score.config.puntoDeOro ? '#F4D35E' : '#DFEAF1'}
            />
          </View>
          <Text style={styles.meta}>Punto de Oro: a 40-40, le point suivant gagne le jeu.</Text>
          <Text style={styles.meta}>Set: 6 jeux, 2 d ecart. Tie-break a 6-6 (sets 1-2). 3e set sans tie-break.</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Serveur initial</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.serverBtn, score.server === 'a' && styles.serverBtnActive]}
                onPress={() => setScore((prev) => setInitialServer(prev, 'a'))}
              >
                <Text style={[styles.serverBtnText, score.server === 'a' && styles.serverBtnTextActive]}>Rouge</Text>
              </Pressable>
              <Pressable
                style={[styles.serverBtn, score.server === 'b' && styles.serverBtnActive]}
                onPress={() => setScore((prev) => setInitialServer(prev, 'b'))}
              >
                <Text style={[styles.serverBtnText, score.server === 'b' && styles.serverBtnTextActive]}>Bleue</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.fullBtn} onPress={() => setFullScreenMode(true)}>
            <Text style={styles.fullBtnText}>Mode arbitre plein ecran</Text>
          </Pressable>

          <Board score={score} setScore={setScore} landscape={landscape} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>3) Enregistrer le match</Text>
          <Text style={styles.label}>Cout total terrain (EUR)</Text>
          <TextInput style={styles.input} value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" />
        </Card>

        <Pressable style={styles.cta} onPress={createManual}>
          <Text style={styles.ctaText}>Enregistrer manuellement</Text>
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

      <Modal visible={fullScreenMode} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.fullRoot}>
          <View style={styles.fullTop}>
            <Text style={styles.fullTitle}>Mode arbitre</Text>
            <Pressable style={styles.fullClose} onPress={() => setFullScreenMode(false)}>
              <Text style={styles.fullCloseText}>Fermer</Text>
            </Pressable>
          </View>
          {!landscape ? <Text style={styles.rotateHint}>Mode paysage force active.</Text> : null}
          <View style={styles.fullBoardWrap}>
            <View style={[styles.fullBoardCard, forcedLandscapeStyle]}>
              <Board score={score} setScore={setScore} landscape />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(score.winner)} transparent animationType="fade">
        <View style={styles.cinematicBackdrop}>
          <Animated.View
            style={[
              styles.cinematicCard,
              {
                borderColor: winnerTone?.color ?? theme.colors.accent,
                transform: [{ scale: cinematicAnim }],
                opacity: cinematicAnim,
              },
            ]}
          >
            <Text style={styles.cinematicTitle}>{winnerTone?.title ?? 'VICTOIRE'}</Text>
            <Text style={styles.cinematicTeam}>{score.winner === 'a' ? 'Equipe Rouge' : 'Equipe Bleue'}</Text>
            <Text style={styles.cinematicSub}>{winnerTone?.subtitle ?? ''}</Text>
            <Text style={styles.cinematicSub}>Score final: {setsPayload.map((set) => `${set.a}-${set.b}`).join(' / ')}</Text>
            <Text style={styles.cinematicSub}>{savedMatchId ? `Match ${savedMatchId.slice(-6)} enregistre.` : 'Enregistrement en cours...'}</Text>
            <Pressable style={styles.cinematicBtn} onPress={closeVictory}>
              <Text style={styles.cinematicBtnText}>Continuer</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
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
  meta: { color: theme.colors.muted, marginBottom: 6, fontFamily: theme.fonts.body },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  playerChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.chip,
  },
  playerChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  playerText: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 12 },
  playerTextActive: { color: '#3A2500' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  optionLabel: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 14 },
  serverBtn: {
    minHeight: 32,
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bgAlt,
    paddingHorizontal: 8,
  },
  serverBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  serverBtnText: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 12 },
  serverBtnTextActive: { color: '#3A2500' },
  fullBtn: {
    minHeight: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#355B71',
    marginBottom: 8,
  },
  fullBtnText: { color: '#F0F7FF', fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase' },
  board: { flexDirection: 'column', gap: 10, marginBottom: 8 },
  boardLandscape: { flexDirection: 'row' },
  side: { flex: 1, minHeight: 170, borderRadius: 16, padding: 14, justifyContent: 'space-between' },
  redSide: { backgroundColor: '#7F1D1D', borderWidth: 1, borderColor: '#E16A6A' },
  blueSide: { backgroundColor: '#1E3A8A', borderWidth: 1, borderColor: '#7FA4FF' },
  sideTitle: { color: '#F8FBFF', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 13, letterSpacing: 1 },
  bigPoint: { color: '#FFFFFF', fontFamily: theme.fonts.display, fontSize: 72, lineHeight: 72, textAlign: 'center' },
  sideMeta: { color: '#E2E8F0', fontFamily: theme.fonts.title, fontSize: 14, textAlign: 'center' },
  sideHint: { color: '#CBD5E1', fontFamily: theme.fonts.body, fontSize: 11, textAlign: 'center' },
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
  cta: { minHeight: 58, borderRadius: 14, backgroundColor: theme.colors.accent, justifyContent: 'center', alignItems: 'center' },
  ctaText: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  feedback: { color: theme.colors.warning, fontFamily: theme.fonts.title },
  row: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  undoBtn: { backgroundColor: '#4C687B' },
  resetBtn: { backgroundColor: '#365A73' },
  accept: { backgroundColor: theme.colors.accent },
  reject: { backgroundColor: theme.colors.danger },
  actionText: { color: '#F8FBFF', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 12 },
  rejectText: { color: '#3D0505' },
  matchCard: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.colors.bgAlt,
  },
  matchTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, marginBottom: 4 },
  sideChange: { color: theme.colors.warning, fontFamily: theme.fonts.title, marginBottom: 6 },
  fullRoot: { flex: 1, backgroundColor: '#07141F', padding: 16 },
  fullTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fullTitle: { color: '#F0F7FF', fontFamily: theme.fonts.title, fontSize: 18 },
  fullClose: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2E4E62' },
  fullCloseText: { color: '#F0F7FF', fontFamily: theme.fonts.title },
  fullBoardWrap: { flex: 1, justifyContent: 'center' },
  fullBoardCard: { width: '100%' },
  rotateHint: { color: theme.colors.warning, fontFamily: theme.fonts.title, textAlign: 'center', marginBottom: 6 },
  cinematicBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 19, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cinematicCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#0F2230',
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  cinematicTitle: { color: '#F4D35E', fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 36 },
  cinematicTeam: { color: '#F8FBFF', fontFamily: theme.fonts.title, fontSize: 18 },
  cinematicSub: { color: '#AEC2D0', fontFamily: theme.fonts.body, textAlign: 'center' },
  cinematicBtn: {
    marginTop: 8,
    minHeight: 44,
    minWidth: 160,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cinematicBtnText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
