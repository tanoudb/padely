import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Card } from '../../components/Card';
import { PirGauge } from '../../components/PirGauge';
import { api } from '../../api/client';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';
import { slotToApiPlayer } from './playConfig';

function toneFromSets(sets, winner) {
  const winnerGames = sets.reduce((sum, set) => sum + (winner === 'a' ? set.a : set.b), 0);
  const loserGames = sets.reduce((sum, set) => sum + (winner === 'a' ? set.b : set.a), 0);
  const gap = winnerGames - loserGames;
  if (gap >= 8) return { title: 'VICTOIRE', subtitle: 'Domination nette' };
  if (gap >= 4) return { title: 'VICTOIRE', subtitle: 'Match controle' };
  if (gap >= 1) return { title: 'VICTOIRE', subtitle: 'Victoire accrochee' };
  return { title: 'MATCH TERMINE', subtitle: 'Resultat enregistre' };
}

export function PlayResultScreen() {
  const { token, user } = useSession();
  const { palette } = useUi();
  const navigation = useNavigation();
  const route = useRoute();
  const { setup, winner, sets } = route.params ?? {};

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [pirDelta, setPirDelta] = useState(0);
  const [error, setError] = useState('');

  const tone = useMemo(() => toneFromSets(sets ?? [], winner), [sets, winner]);
  const scoreLine = (sets ?? []).map((set) => `${set.a}-${set.b}`).join('  ');
  const previousPir = Number(user.pir ?? 0);
  const currentPir = previousPir + Number(pirDelta || 0);

  useEffect(() => {
    let mounted = true;
    async function saveRankedMatch() {
      if (!setup || !Array.isArray(setup.selectedSlots) || setup.selectedSlots.length !== 3 || saving || savedId) return;
      try {
        setSaving(true);
        const [teamA2, teamB1, teamB2] = setup.selectedSlots;
        const out = await api.createMatch(token, {
          teamA: [setup.userId, slotToApiPlayer(teamA2)],
          teamB: [slotToApiPlayer(teamB1), slotToApiPlayer(teamB2)],
          sets,
          mode: setup.matchMode,
          matchFormat: setup.matchFormat,
          goldenPoints: { teamA: 0, teamB: 0 },
          validationMode: setup.matchMode === 'ranked' ? 'cross' : 'friendly',
          totalCostEur: setup.totalCostEur ?? 0,
          clubName: 'Club local',
        });
        if (!mounted) return;
        setSavedId(out.id);
        setPirDelta(Number(out?.pirImpact?.delta ?? 0));
        try {
          const invite = await api.createMatchInvite(token, out.id);
          if (invite?.url && mounted) {
            setInviteUrl(invite.url);
          }
        } catch {
          // Silent: invite link is optional.
        }
      } catch (e) {
        if (mounted) {
          setError(e.message);
        }
      } finally {
        if (mounted) {
          setSaving(false);
        }
      }
    }

    saveRankedMatch();
    return () => {
      mounted = false;
    };
  }, [savedId, saving, setup, sets, token]);

  async function shareInvite() {
    if (!inviteUrl) return;
    await Share.share({
      title: 'Padely',
      message: `Valide mon match Padely: ${inviteUrl}`,
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={styles.centered}>
        <Text style={[styles.title, { color: palette.accent }]}>{tone.title}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary ?? palette.muted }]}>{tone.subtitle}</Text>
        <Text style={[styles.score, { color: palette.text }]}>{scoreLine}</Text>
      </View>

      <Card elevated style={styles.card}>
        <PirGauge pir={currentPir} delta={pirDelta} rank={user.rankName ?? 'Classement'} />
        <Text style={[styles.meta, { color: palette.muted }]}>
          {savedId ? `Match ${savedId.slice(-6)} enregistre` : (saving ? 'Enregistrement en cours...' : 'Pret a enregistrer')}
        </Text>
        {!!error ? <Text style={[styles.meta, { color: palette.danger }]}>{error}</Text> : null}
      </Card>

      <View style={styles.actions}>
        <Pressable
          style={[styles.secondaryBtn, { borderColor: palette.accent }]}
          onPress={shareInvite}
          disabled={!inviteUrl}
        >
          <Text style={[styles.secondaryBtnText, { color: inviteUrl ? palette.accent : palette.muted }]}>PARTAGER</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
          onPress={() => navigation.replace('PlaySetup')}
        >
          <Text style={[styles.primaryBtnText, { color: palette.accentText ?? '#09090B' }]}>NOUVEAU MATCH</Text>
        </Pressable>
        <Pressable onPress={() => navigation.getParent()?.navigate('HomeTab')}>
          <Text style={[styles.ghost, { color: palette.textSecondary ?? palette.muted }]}>Retour accueil</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 18, justifyContent: 'space-between' },
  centered: { alignItems: 'center', gap: 4, marginTop: 24 },
  title: { fontFamily: theme.fonts.display, fontSize: 42, lineHeight: 44, letterSpacing: 0.7 },
  subtitle: { fontFamily: theme.fonts.title, fontSize: 14 },
  score: { marginTop: 14, fontFamily: theme.fonts.mono, fontSize: 30, letterSpacing: 1.2 },
  card: { marginTop: 12 },
  meta: { marginTop: 6, fontFamily: theme.fonts.body, fontSize: 12, textAlign: 'center' },
  actions: { gap: 10, marginBottom: 12 },
  primaryBtn: { minHeight: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 },
  secondaryBtn: { minHeight: 56, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  ghost: { textAlign: 'center', fontFamily: theme.fonts.body, fontSize: 13 },
});
