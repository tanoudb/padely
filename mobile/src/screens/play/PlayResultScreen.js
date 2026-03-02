import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { PlayerCard } from '../../components/PlayerCard';
import { PirGauge } from '../../components/PirGauge';
import { Skeleton } from '../../components/Skeleton';
import { api } from '../../api/client';
import { AnimatedView, useCountUp, useScaleBounce, useStaggeredEntry } from '../../hooks/usePadelyAnimations';
import { useI18n } from '../../state/i18n';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';
import { slotToApiPlayer, slotDisplayName } from './playConfig';
import { getMatchResultTone } from '../../utils/playerContext';

function computeStressTag(sets, teamARating, teamBRating) {
  const safeSets = Array.isArray(sets) ? sets : [];
  const totalGames = safeSets.reduce((sum, set) => sum + Number(set?.a ?? 0) + Number(set?.b ?? 0), 0);
  const margin = Math.abs(safeSets.reduce((sum, set) => sum + Number(set?.a ?? 0) - Number(set?.b ?? 0), 0));
  const ratingDiff = Math.abs(Number(teamARating ?? 0) - Number(teamBRating ?? 0));

  if (totalGames <= 0) return 'controlled';
  if (margin >= totalGames * 0.5) return 'easy';
  if (margin >= totalGames * 0.25) return 'controlled';
  if (ratingDiff < 100 && margin < totalGames * 0.15) return 'chaos';
  return 'battle';
}

function estimateTeamRatings(setup) {
  const resolveSlot = (slot) => {
    if (slot === setup?.userId) return setup?.participants?.[setup?.userId];
    if (typeof slot === 'string') return setup?.participants?.[slot];
    return slot;
  };
  const avg = (slots) => {
    const values = slots
      .map(resolveSlot)
      .map((entry) => Number(entry?.rating ?? entry?.guestRating ?? 1200))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return 1200;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  return {
    a: avg([setup?.userId, setup?.selectedSlots?.[0]]),
    b: avg([setup?.selectedSlots?.[1], setup?.selectedSlots?.[2]]),
  };
}

function scoreLineFromSets(sets = []) {
  return sets.map((set) => `${set.a}-${set.b}`).join('  ');
}

function teamLabels(setup) {
  const partner = setup?.selectedSlots?.[0];
  const one = setup?.selectedSlots?.[1];
  const two = setup?.selectedSlots?.[2];
  return {
    teamA: `${setup?.participants?.[setup?.userId] ?? 'You'} + ${slotDisplayName(partner, setup?.participants)}`,
    teamB: `${slotDisplayName(one, setup?.participants)} + ${slotDisplayName(two, setup?.participants)}`,
  };
}

export function PlayResultScreen() {
  const { token, user } = useSession();
  const { palette } = useUi();
  const { t } = useI18n();
  const navigation = useNavigation();
  const route = useRoute();
  const { setup, winner, sets } = route.params ?? {};

  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [pirDelta, setPirDelta] = useState(0);
  const [error, setError] = useState('');
  const [latestBadge, setLatestBadge] = useState(null);
  const [playerProfilePack, setPlayerProfilePack] = useState(null);

  const showMissingSetup = !setup || !Array.isArray(setup.selectedSlots);
  const labels = useMemo(() => teamLabels(setup ?? {}), [setup]);
  const ratings = useMemo(() => estimateTeamRatings(setup ?? {}), [setup]);
  const stressTag = useMemo(() => computeStressTag(sets ?? [], ratings.a, ratings.b), [sets, ratings.a, ratings.b]);
  const margin = useMemo(
    () => Math.abs((sets ?? []).reduce((sum, set) => sum + Number(set?.a ?? 0) - Number(set?.b ?? 0), 0)),
    [sets],
  );
  const isKeyMatch = Math.abs(ratings.a - ratings.b) < 120 && margin < 4;
  const tone = getMatchResultTone(playerProfilePack, {
    stressTag,
  });
  const stressKey = `match.stress${stressTag[0].toUpperCase()}${stressTag.slice(1)}`;
  const toneTitle = tone.titleKey === 'result.stressTag' ? t(stressKey) : t(tone.titleKey);
  const toneSubtitle = tone.subtitleKey ? t(tone.subtitleKey, tone.subtitleParams ?? {}) : '';

  const scoreLine = scoreLineFromSets(sets ?? []);
  const previousPir = Number(user.pir ?? 0);
  const currentPir = previousPir + Number(pirDelta || 0);
  const pirDeltaLive = useCountUp(pirDelta);
  const pirCurrentLive = useCountUp(currentPir);
  const titleEntry = useStaggeredEntry(0, !showMissingSetup);
  const cardEntry = useStaggeredEntry(1, !showMissingSetup);
  const memoryEntry = useStaggeredEntry(2, !showMissingSetup);
  const actionsEntry = useStaggeredEntry(3, !showMissingSetup);
  const primaryBounce = useScaleBounce(savedId || pirDelta);

  useEffect(() => {
    let mounted = true;
    async function saveMatch() {
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
          const [invite, badges, profilePack] = await Promise.all([
            api.createMatchInvite(token, out.id),
            api.badges(token, user.id),
            api.playerProfile(token),
          ]);
          if (invite?.url && mounted) {
            setInviteUrl(invite.url);
          }
          if (Array.isArray(badges?.newlyUnlocked) && badges.newlyUnlocked.length && mounted) {
            setLatestBadge(badges.newlyUnlocked[0]);
          }
          if (mounted) {
            setPlayerProfilePack(profilePack);
          }
        } catch {
          // Optional enrichments do not block result screen.
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

    saveMatch();
    return () => {
      mounted = false;
    };
  }, [savedId, saving, setup, sets, token, user.id]);

  async function shareRecap() {
    const now = new Date();
    const message = [
      `PADELY`,
      `${toneTitle}${toneSubtitle ? ` - ${toneSubtitle}` : ''}`,
      `${t('play.scoreLabel', { score: scoreLine || 'N/A' })}`,
      `${labels.teamA} vs ${labels.teamB}`,
      `${t('home.formScore', { score: Math.round(playerProfilePack?.playerProfile?.formScore ?? 0) })}`,
      `${t('result.stressTag', { tag: t(stressKey) })}`,
      isKeyMatch ? t('result.keyMatch') : '',
      `PIR ${pirDelta >= 0 ? '+' : ''}${pirDelta}`,
      `${t('play.matchLabel', { id: savedId ? savedId.slice(-6) : '------' })}`,
      `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
      inviteUrl ? inviteUrl : '',
    ].filter(Boolean).join('\n');

    await Share.share({
      title: 'Padely',
      message,
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {showMissingSetup ? (
        <View style={styles.fallbackWrap}>
          <EmptyState title={t('result.unavailableTitle')} body={t('result.unavailableBody')} variant="result" />
          <Pressable style={[styles.primaryBtn, { backgroundColor: palette.accent }]} onPress={() => navigation.replace('PlaySetup')}>
            <Text style={[styles.primaryBtnText, { color: palette.accentText }]}>{t('play.replay')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AnimatedView style={titleEntry}>
            <View style={styles.centered}>
              <Text style={[styles.title, { color: palette.accent }]}>{winner === 'a' ? t('play.victoryDefault') : t('play.matchFinishedTitle')}</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary ?? palette.muted }]}>{toneTitle}</Text>
              {!!toneSubtitle ? <Text style={[styles.subtitle, { color: palette.textSecondary ?? palette.muted }]}>{toneSubtitle}</Text> : null}
              <Text style={[styles.score, { color: palette.text }]}>{scoreLine}</Text>
              <View style={styles.tagsRow}>
                <View style={[styles.tag, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}>
                  <Text style={[styles.tagText, { color: palette.text }]}>{t(`match.stress${stressTag[0].toUpperCase()}${stressTag.slice(1)}`)}</Text>
                </View>
                {isKeyMatch ? (
                  <View style={[styles.tag, { borderColor: palette.warning, backgroundColor: palette.accentMuted }]}>
                    <Text style={[styles.tagText, { color: palette.warning }]}>{t('match.keyMatch')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </AnimatedView>

          <AnimatedView style={cardEntry}>
            <Card elevated style={styles.card}>
              {saving && !savedId ? (
                <>
                  <Skeleton width="100%" height={170} radius={18} />
                  <Skeleton width="70%" height={12} style={{ marginTop: 8, alignSelf: 'center' }} />
                </>
              ) : (
                <>
                  <PirGauge pir={pirCurrentLive} delta={pirDeltaLive} rank={user.rankName ?? 'PIR'} />
                  {latestBadge ? (
                    <Text style={[styles.meta, { color: palette.accent }]}>
                      {`${latestBadge.title ?? latestBadge.badgeKey} · ${t(`badge.tier.${latestBadge.tier ?? 'gold'}`)}`}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: palette.muted }]}>
                    {savedId ? t('result.savedLine', { id: savedId.slice(-6) }) : (saving ? t('result.savingLine') : t('result.readyLine'))}
                  </Text>
                </>
              )}
              {!!error ? <Text style={[styles.meta, { color: palette.danger }]}>{error}</Text> : null}
            </Card>
          </AnimatedView>

          <AnimatedView style={memoryEntry}>
            <Card style={styles.memoryCard}>
              <Text style={[styles.memoryTitle, { color: palette.text }]}>{t('result.memoryTitle')}</Text>
              <PlayerCard
                size="compact"
                player={{ displayName: user.displayName, arcadeTag: user.arcadeTag }}
                pir={currentPir}
                rating={user.rating}
                formScore={Number(playerProfilePack?.playerProfile?.formScore ?? 0)}
                personality={playerProfilePack?.playerProfile?.personality ?? null}
                type={playerProfilePack?.playerProfile?.type ?? null}
                pinnedBadges={latestBadge ? [{ key: latestBadge.badgeKey, title: latestBadge.title, tier: latestBadge.tier }] : []}
                pirDna={{}}
              />
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{`${labels.teamA} vs ${labels.teamB}`}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{`${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`}</Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>{`PIR ${pirDelta >= 0 ? '+' : ''}${pirDelta}`}</Text>
            </Card>
          </AnimatedView>

          <AnimatedView style={actionsEntry}>
            <View style={styles.actions}>
              <Pressable style={[styles.secondaryBtn, { borderColor: palette.accent }]} onPress={shareRecap}>
                <Text style={[styles.secondaryBtnText, { color: palette.accent }]}>{t('play.share')}</Text>
              </Pressable>
              <AnimatedView style={primaryBounce}>
                <Pressable style={[styles.primaryBtn, { backgroundColor: palette.accent }]} onPress={() => navigation.replace('PlaySetup')}>
                  <Text style={[styles.primaryBtnText, { color: palette.accentText }]}>{t('play.replay')}</Text>
                </Pressable>
              </AnimatedView>
              <Pressable onPress={() => navigation.getParent()?.navigate('HomeTab')}>
                <Text style={[styles.ghost, { color: palette.textSecondary ?? palette.muted }]}>{t('play.home')}</Text>
              </Pressable>
            </View>
          </AnimatedView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 18, justifyContent: 'space-between' },
  fallbackWrap: { flex: 1, justifyContent: 'center', gap: 14 },
  centered: { alignItems: 'center', gap: 4, marginTop: 18 },
  title: { fontFamily: theme.fonts.display, fontSize: 36, lineHeight: 38, letterSpacing: 0.5 },
  subtitle: { fontFamily: theme.fonts.title, fontSize: 13, textAlign: 'center' },
  score: { marginTop: 10, fontFamily: theme.fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: 1.2 },
  tagsRow: { marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  tag: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  card: { marginTop: 8 },
  memoryCard: { marginTop: 8, gap: 2 },
  memoryTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  meta: { marginTop: 4, fontFamily: theme.fonts.body, fontSize: 12, textAlign: 'center' },
  actions: { gap: 10, marginBottom: 10 },
  primaryBtn: { minHeight: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 },
  secondaryBtn: { minHeight: 54, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  ghost: { textAlign: 'center', fontFamily: theme.fonts.body, fontSize: 13 },
});
