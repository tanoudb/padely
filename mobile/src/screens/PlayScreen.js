import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { QrScannerModal } from '../components/QrScannerModal';
import { VictoryOverlay } from '../components/VictoryOverlay';
import { useI18n } from '../state/i18n';
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

function scoreConfigFromPreferences(settings = {}) {
  const pointRule = settings.pointRule ?? 'punto_de_oro';
  const matchFormat = settings.matchFormat ?? 'marathon';
  const puntoDeOro = pointRule !== 'avantage';

  if (matchFormat === 'standard') {
    return {
      puntoDeOro,
      setsToWin: 2,
      gamesToWinSet: 6,
      tieBreakAtGames: 6,
      tieBreakPoints: 7,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'full_set',
      superTieBreakPoints: 10,
    };
  }

  if (matchFormat === 'club') {
    return {
      puntoDeOro,
      setsToWin: 2,
      gamesToWinSet: 6,
      tieBreakAtGames: 6,
      tieBreakPoints: 7,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'super_tiebreak',
      superTieBreakPoints: 10,
    };
  }

  return {
    puntoDeOro,
    setsToWin: 3,
    gamesToWinSet: 4,
    tieBreakAtGames: 3,
    tieBreakPoints: 7,
    noTieBreakInDecidingSet: false,
    decidingSetMode: 'full_set',
    superTieBreakPoints: 10,
  };
}

function matchFormatLabel(format, t) {
  if (format === 'standard') return t('play.formatStandardLabel');
  if (format === 'club') return t('play.formatClubLabel');
  return t('play.formatMarathonLabel');
}

function arcadeTagFromQrValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  if (value.startsWith('padely://arcade/')) {
    return decodeURIComponent(value.slice('padely://arcade/'.length)).trim();
  }

  if (value.startsWith('PADELY_ARCADE:')) {
    return value.slice('PADELY_ARCADE:'.length).trim();
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      const qpTag = url.searchParams.get('tag');
      if (qpTag) return qpTag.trim();
      const chunks = url.pathname.split('/').filter(Boolean);
      if (chunks.length >= 2 && chunks[chunks.length - 2] === 'arcade') {
        return decodeURIComponent(chunks[chunks.length - 1]).trim();
      }
    } catch {
      return value;
    }
  }

  return value;
}

function MatchCard({ match, onValidate, onOpenPir, t }) {
  const label = match.sets.map((set) => `${set.a}-${set.b}`).join(' / ');
  const pirDelta = Number(match?.pirImpact?.delta ?? 0);
  const pirDeltaLabel = pirDelta > 0 ? `+${pirDelta.toFixed(2)}` : pirDelta.toFixed(2);
  const pirReasons = (match?.pirImpact?.reasons ?? []).slice(0, 3);
  return (
    <View style={styles.matchCard}>
      <Text style={styles.matchTitle}>{t('play.matchLabel', { id: match.id.slice(-6) })}</Text>
      <Text style={styles.meta}>{t('play.scoreLabel', { score: label || 'N/A' })}</Text>
      <Text style={styles.meta}>
        {t('play.statusLabel', {
          status: match.status,
          mode: match.mode === 'friendly' ? t('play.modeFriendly') : t('play.modeRanked'),
        })}
      </Text>
      {match?.pirImpact ? (
        <View style={styles.pirBox}>
          <Text style={styles.pirTitle}>{t('play.pirImpact', { delta: pirDeltaLabel })}</Text>
          <Text style={styles.pirMeta}>
            {t('play.rankLine', {
              before: Math.round(match.pirImpact.before),
              after: Math.round(match.pirImpact.after),
              pir: Math.round(match.pirImpact.pir ?? 0),
            })}
          </Text>
          {pirReasons.map((line, index) => (
            <Text key={`${match.id}-pir-${index}`} style={styles.pirReason}>• {line}</Text>
          ))}
          <Pressable style={styles.pirDetailBtn} onPress={() => onOpenPir?.(match)}>
            <Text style={styles.pirDetailBtnText}>{t('play.explainPir')}</Text>
          </Pressable>
        </View>
      ) : null}
      {match.canValidate ? (
        <View style={styles.row}>
          <Pressable style={[styles.actionBtn, styles.accept]} onPress={() => onValidate(match.id, true)}>
            <Text style={styles.actionText}>{t('play.validate')}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.reject]} onPress={() => onValidate(match.id, false)}>
            <Text style={[styles.actionText, styles.rejectText]}>{t('play.reject')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RefereeSide({
  team,
  serving,
  point,
  games,
  onPress,
  pointSize,
  gameSize,
  titleSize,
  teamLabel,
  gamesLabel,
  tapHint,
  pointPulse,
  flashOpacity,
}) {
  const isRed = team === 'a';
  const gradient = isRed ? ['#7D1620', '#B5292E'] : ['#20367E', '#3457C1'];
  return (
    <Pressable style={[styles.refSide, isRed ? styles.redSide : styles.blueSide]} onPress={onPress}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[styles.refFlash, { opacity: flashOpacity }]} />
      <View style={styles.refHeadRow}>
        <Text style={[styles.refSideTitle, { fontSize: titleSize }]}>
          {teamLabel}
        </Text>
        {serving ? <View style={styles.serviceBall} /> : null}
      </View>
      <Animated.Text
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        numberOfLines={1}
        style={[
          styles.refPoint,
          { fontSize: pointSize, lineHeight: Math.round(pointSize * 1.08) },
          { transform: [{ scale: pointPulse }] },
        ]}
      >
        {point}
      </Animated.Text>
      <Text style={[styles.refGames, { fontSize: gameSize }]}>{gamesLabel}: {games}</Text>
      <Text style={styles.refTapHint}>{tapHint}</Text>
    </Pressable>
  );
}

function victoryTone(sets, winner) {
  const totalGamesWinner = sets.reduce((sum, set) => sum + (winner === 'a' ? set.a : set.b), 0);
  const totalGamesLoser = sets.reduce((sum, set) => sum + (winner === 'a' ? set.b : set.a), 0);
  const gap = totalGamesWinner - totalGamesLoser;

  if (gap >= 8) {
    return {
      titleKey: 'play.victoryCrushingTitle',
      subtitleKey: 'play.victoryCrushingSub',
      color: '#F4D35E',
    };
  }

  if (gap >= 4) {
    return {
      titleKey: 'play.victoryControlledTitle',
      subtitleKey: 'play.victoryControlledSub',
      color: '#00D1B2',
    };
  }

  return {
    titleKey: 'play.victoryTightTitle',
    subtitleKey: 'play.victoryTightSub',
    color: '#FFAD5A',
  };
}

export function PlayScreen() {
  const { token, user } = useSession();
  const { t } = useI18n();
  const matchFormat = user.settings?.matchFormat ?? 'marathon';
  const autoSaveMatch = Boolean(user.settings?.autoSaveMatch ?? true);
  const defaultMatchMode = user.settings?.defaultMatchMode === 'friendly' ? 'friendly' : 'ranked';
  const [players, setPlayers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [arcadeTagInput, setArcadeTagInput] = useState('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestLevel, setGuestLevel] = useState('Intermediaire');
  const [matchMode, setMatchMode] = useState(defaultMatchMode);
  const [totalCost, setTotalCost] = useState('48');
  const [feedback, setFeedback] = useState('');
  const [matches, setMatches] = useState([]);
  const [score, setScore] = useState(createScoreState(scoreConfigFromPreferences(user.settings)));
  const [autoSideSwitch, setAutoSideSwitch] = useState(Boolean(user.settings?.autoSideSwitch ?? true));
  const [fullScreenMode, setFullScreenMode] = useState(false);
  const [forceLandscapeLayout, setForceLandscapeLayout] = useState(true);
  const [modalOrientation, setModalOrientation] = useState('unknown');
  const [savingAuto, setSavingAuto] = useState(false);
  const [savedMatchId, setSavedMatchId] = useState(null);
  const [savedInviteUrl, setSavedInviteUrl] = useState('');
  const [pirDetail, setPirDetail] = useState(null);
  const [victoryPirDelta, setVictoryPirDelta] = useState(0);

  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const pointPulseA = useRef(new Animated.Value(1)).current;
  const pointPulseB = useRef(new Animated.Value(1)).current;
  const flashA = useRef(new Animated.Value(0)).current;
  const flashB = useRef(new Animated.Value(0)).current;
  const prevSetGamesRef = useRef({ a: 0, b: 0, sets: 0 });

  const selectablePlayers = useMemo(
    () => players.filter((p) => p.id !== user.id),
    [players, user.id]
  );

  const selectedSlots = useMemo(() => ([
    ...selectedUsers,
    ...guests.map((g) => ({
      kind: 'guest',
      guestId: g.id,
      guestName: g.name,
      guestLevel: g.level,
    })),
  ]), [selectedUsers, guests]);

  const displayPoints = getDisplayPoints(score);
  const currentServer = getCurrentServer(score);
  const oddGamesInCurrentSet = (score.currentSet.a + score.currentSet.b) % 2 === 1;
  const setsPayload = useMemo(() => scoreStateToSets(score), [score]);
  const winnerTone = useMemo(() => {
    if (!score.winner || setsPayload.length === 0) {
      return null;
    }
    return victoryTone(setsPayload, score.winner);
  }, [score.winner, setsPayload]);
  const setsWonA = useMemo(() => score.sets.filter((set) => set.a > set.b).length, [score.sets]);
  const setsWonB = useMemo(() => score.sets.filter((set) => set.b > set.a).length, [score.sets]);
  const estimatedWatchByPlayer = useMemo(() => {
    const allSets = setsPayload.length ? setsPayload : scoreStateToSets(score);
    const totalGames = allSets.reduce((sum, set) => sum + set.a + set.b, 0);
    const intensity = Math.max(35, Math.min(95, 35 + totalGames * 3));
    const distance = Number((0.09 * totalGames + 0.6).toFixed(2));
    const calories = Math.round(22 * totalGames + 130);
    const hr = Math.round(118 + totalGames * 1.6);
    const ox = Math.max(92, Math.min(99, 97 - Math.round(totalGames / 16)));

    const payload = {};
    const userIds = [user.id, ...selectedUsers];
    userIds.forEach((id) => {
      payload[id] = {
        distanceKm: distance,
        calories,
        intensityScore: intensity,
        heartRateAvg: hr,
        oxygenAvg: ox,
      };
    });
    guests.forEach((g) => {
      payload[g.id] = {
        distanceKm: Number((distance * 0.9).toFixed(2)),
        calories: Math.round(calories * 0.85),
        intensityScore: Math.max(25, intensity - 10),
        heartRateAvg: Math.max(95, hr - 12),
        oxygenAvg: ox,
      };
    });
    return payload;
  }, [setsPayload, score, user.id, selectedUsers, guests]);

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
    const cfg = scoreConfigFromPreferences(user.settings);
    setScore(resetScore(cfg));
    setMatchMode(defaultMatchMode);
    setAutoSideSwitch(Boolean(user.settings?.autoSideSwitch ?? true));
  }, [user.settings, defaultMatchMode]);

  useEffect(() => {
    const prev = prevSetGamesRef.current;
    if (score.currentSet.a > prev.a) {
      flashA.setValue(0.55);
      Animated.timing(flashA, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (score.currentSet.b > prev.b) {
      flashB.setValue(0.55);
      Animated.timing(flashB, { toValue: 0, duration: 260, useNativeDriver: true }).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (score.sets.length > prev.sets) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    prevSetGamesRef.current = {
      a: score.currentSet.a,
      b: score.currentSet.b,
      sets: score.sets.length,
    };
  }, [score.currentSet.a, score.currentSet.b, score.sets.length, flashA, flashB]);

  useEffect(() => {
    if (!score.winner) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [score.winner]);

  useEffect(() => {
    async function autoSave() {
      if (!autoSaveMatch || !score.winner || savingAuto || savedMatchId) {
        return;
      }
      if (selectedSlots.length !== 3) {
        setFeedback(t('play.msgNeedPlayers'));
        return;
      }

      try {
        setSavingAuto(true);
        const [teamA2, teamB1, teamB2] = selectedSlots;
        const out = await api.createMatch(token, {
          teamA: [user.id, teamA2],
          teamB: [teamB1, teamB2],
          sets: setsPayload,
          matchFormat,
          mode: matchMode,
          goldenPoints: { teamA: 0, teamB: 0 },
          validationMode: matchMode === 'ranked' ? 'cross' : 'friendly',
          totalCostEur: Number(totalCost),
          clubName: 'Club local',
          watchByPlayer: estimatedWatchByPlayer,
        });
        setVictoryPirDelta(Number(out?.pirImpact?.delta ?? 0));

        let inviteSuffix = '';
        try {
          const invite = await api.createMatchInvite(token, out.id);
          if (invite?.url) {
            inviteSuffix = t('play.inviteSuffix');
            setSavedInviteUrl(invite.url);
          }
        } catch {
          inviteSuffix = '';
        }
        setSavedMatchId(out.id);
        if (matchMode === 'ranked') {
          setFeedback(t('play.msgAutoSavedRanked', { id: out.id.slice(-6), suffix: inviteSuffix }));
        } else {
          setFeedback(t('play.msgAutoSaved', { id: out.id.slice(-6), suffix: inviteSuffix }));
        }
        await refresh();
      } catch (e) {
        setFeedback(t('play.msgAutoSaveError', { error: e.message }));
      } finally {
        setSavingAuto(false);
      }
    }

    autoSave();
  }, [autoSaveMatch, score.winner, selectedSlots, setsPayload, totalCost, token, user.id, savingAuto, savedMatchId, matchMode, matchFormat, estimatedWatchByPlayer]);

  function toggleUser(playerId) {
    setSelectedUsers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length + guests.length >= 3) {
        return prev;
      }
      return [...prev, playerId];
    });
  }

  function removeGuest(guestId) {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  }

  function addGuest() {
    if (matchMode === 'ranked') {
      setFeedback(t('play.msgRankedNoGuests'));
      return;
    }
    const name = guestName.trim();
    if (!name) {
      setFeedback(t('play.msgEnterGuest'));
      return;
    }
    if (selectedUsers.length + guests.length >= 3) {
      setFeedback(t('play.msgAlreadyThree'));
      return;
    }

    setGuests((prev) => ([...prev, {
      id: `guest_${Date.now()}_${Math.round(Math.random() * 9999)}`,
      name,
      level: guestLevel,
    }]));
    setGuestName('');
    setFeedback(t('play.msgGuestAdded'));
  }

  async function addByArcadeTag(tagValue = arcadeTagInput.trim()) {
    if (matchMode === 'ranked' && selectedUsers.length >= 3) {
      setFeedback(t('play.msgRankedNeedThree'));
      return false;
    }
    const tag = tagValue.trim();
    if (!tag) {
      setFeedback(t('play.msgEnterTag'));
      return false;
    }
    if (selectedUsers.length + guests.length >= 3) {
      setFeedback(t('play.msgAlreadyThree'));
      return false;
    }
    try {
      const out = await api.arcadeSearch(token, tag);
      if (!out?.id || out.id === user.id) {
        throw new Error(t('play.msgInvalidTag'));
      }
      setSelectedUsers((prev) => (prev.includes(out.id) ? prev : [...prev, out.id].slice(0, 3)));
      setArcadeTagInput('');
      setFeedback(t('play.msgPlayerAddedTag', { name: out.displayName }));
      return true;
    } catch (e) {
      setFeedback(e.message);
      return false;
    }
  }

  async function onScanPlayerQr(rawValue) {
    const tag = arcadeTagFromQrValue(rawValue);
    if (!tag) {
      setFeedback(t('play.msgInvalidQr'));
      return false;
    }
    const ok = await addByArcadeTag(tag);
    if (ok) {
      setQrScannerOpen(false);
    }
    return ok;
  }

  function setMatchModeSafe(nextMode) {
    setMatchMode(nextMode);
    if (nextMode === 'ranked' && guests.length > 0) {
      setGuests([]);
      setFeedback(t('play.msgGuestsRemoved'));
    }
  }

  async function shareInvite() {
    if (!savedInviteUrl || !savedMatchId) {
      setFeedback(t('play.msgNoShareLink'));
      return;
    }
    try {
      await Share.share({
        message: t('play.shareInviteMessage', { url: savedInviteUrl }),
        title: t('play.shareInviteTitle', { id: savedMatchId.slice(-6) }),
      });
    } catch (e) {
      setFeedback(t('play.msgShareUnavailable', { error: e.message }));
    }
  }

  async function createManual() {
    setFeedback('');
    try {
      if (selectedSlots.length !== 3) {
        throw new Error(t('play.msgNeedSelectThree'));
      }

      if (setsPayload.length === 0) {
        throw new Error(t('play.msgNeedAtLeastSet'));
      }

      const [teamA2, teamB1, teamB2] = selectedSlots;
      const out = await api.createMatch(token, {
        teamA: [user.id, teamA2],
        teamB: [teamB1, teamB2],
        sets: setsPayload,
        matchFormat,
        mode: matchMode,
        goldenPoints: { teamA: 0, teamB: 0 },
        validationMode: matchMode === 'ranked' ? 'cross' : 'friendly',
        totalCostEur: Number(totalCost),
        clubName: 'Club local',
        watchByPlayer: estimatedWatchByPlayer,
      });
      setVictoryPirDelta(Number(out?.pirImpact?.delta ?? 0));

      let inviteSuffix = '';
      try {
        const invite = await api.createMatchInvite(token, out.id);
        if (invite?.url) {
          setSavedInviteUrl(invite.url);
          inviteSuffix = t('play.inviteSuffix');
        }
      } catch {
        inviteSuffix = '';
      }
      if (matchMode === 'ranked') {
        setFeedback(t('play.msgCreatedRanked', { id: out.id.slice(-6), suffix: inviteSuffix }));
      } else {
        setFeedback(t('play.msgCreated', { id: out.id.slice(-6), suffix: inviteSuffix }));
      }
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
      setFeedback(accepted ? t('play.msgScoreValid') : t('play.msgScoreRejected'));
      await refresh();
    } catch (e) {
      setFeedback(e.message);
    }
  }

  function closeVictory() {
    setScore(resetScore(score.config));
    setSavedMatchId(null);
    setSavedInviteUrl('');
    setVictoryPirDelta(0);
    setFullScreenMode(false);
    setFeedback(t('play.msgNewMatchReady'));
  }

  function pulsePoint(side) {
    const pulse = side === 'a' ? pointPulseA : pointPulseB;
    pulse.setValue(1);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 120, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }

  function onScorePoint(side) {
    if (score.winner) return;
    pulsePoint(side);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setScore((prev) => addPoint(prev, side));
  }

  const orientationIsLandscape = modalOrientation.includes('LANDSCAPE') || modalOrientation.includes('landscape');
  const refereeLandscape = fullScreenMode ? (forceLandscapeLayout || landscape || orientationIsLandscape) : landscape;
  const shortestSide = Math.min(width, height);
  const pointSize = refereeLandscape
    ? Math.max(80, Math.min(148, Math.round(shortestSide * 0.33)))
    : Math.max(72, Math.min(118, Math.round(shortestSide * 0.25)));
  const gameSize = refereeLandscape ? 24 : 20;
  const titleSize = refereeLandscape ? 28 : 22;
  const refereeLayoutStyle = refereeLandscape ? styles.refBoardLandscape : styles.refBoardPortrait;
  const shouldSwapSides = autoSideSwitch && oddGamesInCurrentSet;
  const slotA = shouldSwapSides ? 'b' : 'a';
  const slotB = shouldSwapSides ? 'a' : 'b';

  const slotPoint = (team) => (team === 'a' ? displayPoints.a : displayPoints.b);
  const slotGames = (team) => (team === 'a' ? score.currentSet.a : score.currentSet.b);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('play.boardKicker')}</Text>
          <Text style={styles.h1}>{t('play.boardTitle')}</Text>
          <Text style={styles.headerSub}>{t('play.boardPitch')}</Text>
        </View>

        <Card elevated>
          <Text style={styles.sectionTitle}>{t('play.matchMode')}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.modeBtn, matchMode === 'friendly' && styles.modeBtnActiveFriendly]}
              onPress={() => setMatchModeSafe('friendly')}
            >
              <Text style={[styles.modeBtnTitle, matchMode === 'friendly' && styles.modeBtnTitleActive]}>{t('play.modeFriendly')}</Text>
              <Text style={[styles.modeBtnSub, matchMode === 'friendly' && styles.modeBtnSubActive]}>
                {t('play.modeFriendlySub')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, matchMode === 'ranked' && styles.modeBtnActiveRanked]}
              onPress={() => setMatchModeSafe('ranked')}
            >
              <Text style={[styles.modeBtnTitle, matchMode === 'ranked' && styles.modeBtnTitleActive]}>{t('play.modeRanked')}</Text>
              <Text style={[styles.modeBtnSub, matchMode === 'ranked' && styles.modeBtnSubActive]}>
                {t('play.modeRankedSub')}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {matchMode === 'ranked'
              ? t('play.impactRanked')
              : t('play.impactFriendly')}
          </Text>
        </Card>

        <Card elevated>
          <Text style={styles.sectionTitle}>{t('play.playersTitle')}</Text>
          <Text style={styles.meta}>{t('play.playersOrder')}</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.rowTagInput]}
              placeholder={t('play.arcadePlaceholder')}
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="characters"
              value={arcadeTagInput}
              onChangeText={setArcadeTagInput}
            />
            <Pressable style={styles.tagBtnGhost} onPress={() => setQrScannerOpen(true)}>
              <Text style={styles.tagBtnGhostText}>{t('play.scanQr')}</Text>
            </Pressable>
            <Pressable style={styles.tagBtn} onPress={addByArcadeTag}>
              <Text style={styles.tagBtnText}>{t('play.addTag')}</Text>
            </Pressable>
          </View>
          <View style={styles.wrap}>
            {selectablePlayers.map((p) => {
              const active = selectedUsers.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  style={[styles.playerChip, active && styles.playerChipActive]}
                  onPress={() => toggleUser(p.id)}
                >
                  <Text style={[styles.playerText, active && styles.playerTextActive]}>{p.displayName} ({p.rating})</Text>
                </Pressable>
              );
            })}
          </View>

          {matchMode === 'friendly' ? (
            <View style={styles.rowWrap}>
              <TextInput
                style={[styles.input, styles.guestInput]}
                placeholder={t('play.guestName')}
                placeholderTextColor={theme.colors.muted}
                value={guestName}
                onChangeText={setGuestName}
              />
              <View style={styles.guestLevels}>
                {[
                  { value: 'Debutant', label: t('play.guestBeginner') },
                  { value: 'Intermediaire', label: t('play.guestIntermediate') },
                  { value: 'Confirme', label: t('play.guestAdvanced') },
                ].map((lvl) => (
                  <Pressable
                    key={lvl.value}
                    style={[styles.levelChip, guestLevel === lvl.value && styles.levelChipActive]}
                    onPress={() => setGuestLevel(lvl.value)}
                  >
                    <Text style={[styles.levelChipText, guestLevel === lvl.value && styles.levelChipTextActive]}>{lvl.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.addGuestBtn} onPress={addGuest}>
                <Text style={styles.addGuestText}>{t('play.addGuest')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.meta}>{t('play.noGuestRanked')}</Text>
          )}

          <View style={styles.wrap}>
            {guests.map((g) => (
              <Pressable key={g.id} style={styles.guestBadge} onPress={() => removeGuest(g.id)}>
                <Text style={styles.guestBadgeText}>{g.name} ({g.level}) ✕</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>{t('play.selectedTotal', { count: selectedSlots.length })}</Text>
        </Card>

        <Card>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('play.punto')}</Text>
            <Switch
              value={score.config.puntoDeOro}
              onValueChange={(value) => setScore((prev) => setPuntoDeOro(prev, value))}
              trackColor={{ false: '#29495F', true: '#C89D20' }}
              thumbColor={score.config.puntoDeOro ? '#F4D35E' : '#DFEAF1'}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('play.autoSide')}</Text>
            <Switch
              value={autoSideSwitch}
              onValueChange={setAutoSideSwitch}
              trackColor={{ false: '#29495F', true: '#2E6F5E' }}
              thumbColor={autoSideSwitch ? '#00D1B2' : '#DFEAF1'}
            />
          </View>

          <Text style={styles.meta}>{t('play.rule', { rule: score.config.puntoDeOro ? t('home.pointPunto') : t('home.pointAdv') })}</Text>
          <Text style={styles.meta}>{t('play.formatAuto', { format: matchFormatLabel(user.settings?.matchFormat, t) })}</Text>
          <Text style={styles.meta}>{t('play.setsRequired', { sets: score.config.setsToWin, tb: score.config.tieBreakPoints })}</Text>
          <Text style={styles.meta}>{t('play.autoSaveState', { state: autoSaveMatch ? t('play.autoStateOn') : t('play.autoStateOff') })}</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>{t('play.initialServer')}</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.serverBtn, score.server === 'a' && styles.serverBtnActive]}
                onPress={() => setScore((prev) => setInitialServer(prev, 'a'))}
              >
                <Text style={[styles.serverBtnText, score.server === 'a' && styles.serverBtnTextActive]}>{t('play.red')}</Text>
              </Pressable>
              <Pressable
                style={[styles.serverBtn, score.server === 'b' && styles.serverBtnActive]}
                onPress={() => setScore((prev) => setInitialServer(prev, 'b'))}
              >
                <Text style={[styles.serverBtnText, score.server === 'b' && styles.serverBtnTextActive]}>{t('play.blue')}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.fullBtn} onPress={() => setFullScreenMode(true)}>
            <Text style={styles.fullBtnText}>{t('play.fullscreen')}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t('play.saveSection')}</Text>
          <Text style={styles.label}>{t('play.courtCost')}</Text>
          <TextInput style={styles.input} value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" />
        </Card>

        <Pressable style={styles.cta} onPress={createManual}>
          <Text style={styles.ctaText}>{t('play.saveManual')}</Text>
        </Pressable>

        {!!feedback && <Text style={styles.feedback}>{feedback}</Text>}

        <Card>
          <Text style={styles.sectionTitle}>{t('play.recentMatches')}</Text>
          {matches.length === 0 ? (
            <Text style={styles.meta}>{t('play.noMatch')}</Text>
          ) : (
            matches.slice(0, 8).map((match) => (
              <MatchCard key={match.id} match={match} onValidate={validate} onOpenPir={setPirDetail} t={t} />
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={fullScreenMode}
        animationType="slide"
        presentationStyle="fullScreen"
        supportedOrientations={Platform.OS === 'ios'
          ? ['portrait', 'landscape-left', 'landscape-right']
          : ['portrait', 'landscape']}
        onOrientationChange={(event) => {
          const nextOrientation = event?.nativeEvent?.orientation;
          if (nextOrientation) {
            setModalOrientation(nextOrientation);
          }
        }}
      >
        <SafeAreaView style={styles.fullRoot}>
          <View style={styles.fullTop}>
            <Text style={styles.fullTitle}>{t('play.referee')}</Text>
            <Pressable style={styles.fullClose} onPress={() => setFullScreenMode(false)}>
              <Text style={styles.fullCloseText}>{t('home.close')}</Text>
            </Pressable>
          </View>

          <View style={styles.refControlsRow}>
            <Text style={styles.refControlsLabel}>{t('play.forceLandscape')}</Text>
            <Switch
              value={forceLandscapeLayout}
              onValueChange={setForceLandscapeLayout}
              trackColor={{ false: '#29495F', true: '#2F7B66' }}
              thumbColor={forceLandscapeLayout ? '#8BF2CF' : '#DFEAF1'}
            />
          </View>

          <View style={[styles.refInfoRow, !refereeLandscape && styles.refInfoRowPortrait]}>
            <Text style={styles.refInfoText}>{displayPoints.tieBreak ? t('play.tieBreakOn') : t('play.standardGame')}</Text>
            <Text style={styles.refInfoText}>{t('play.setsLabel')}: {score.sets.map((set) => `${set.a}-${set.b}`).join(' / ') || t('play.noSets')}</Text>
            <Text style={styles.refInfoText}>
              {t('play.service', {
                team: currentServer === 'a' ? t('play.red') : t('play.blue'),
                a: setsWonA,
                b: setsWonB,
                target: score.config.setsToWin,
              })}
            </Text>
          </View>

          {score.sideChangeAlert ? <Text style={styles.sideChange}>{t('play.sideChange')}</Text> : null}

          <View style={[styles.refBoard, refereeLayoutStyle]}>
            <RefereeSide
              team={slotA}
              serving={currentServer === slotA}
              point={slotPoint(slotA)}
              games={slotGames(slotA)}
              onPress={() => onScorePoint(slotA)}
              pointSize={pointSize}
              gameSize={gameSize}
              titleSize={titleSize}
              teamLabel={slotA === 'a' ? t('play.teamRed') : t('play.teamBlue')}
              gamesLabel={t('play.games')}
              tapHint={t('play.tapPoint')}
              pointPulse={slotA === 'a' ? pointPulseA : pointPulseB}
              flashOpacity={slotA === 'a' ? flashA : flashB}
            />
            <RefereeSide
              team={slotB}
              serving={currentServer === slotB}
              point={slotPoint(slotB)}
              games={slotGames(slotB)}
              onPress={() => onScorePoint(slotB)}
              pointSize={pointSize}
              gameSize={gameSize}
              titleSize={titleSize}
              teamLabel={slotB === 'a' ? t('play.teamRed') : t('play.teamBlue')}
              gamesLabel={t('play.games')}
              tapHint={t('play.tapPoint')}
              pointPulse={slotB === 'a' ? pointPulseA : pointPulseB}
              flashOpacity={slotB === 'a' ? flashA : flashB}
            />
          </View>

          <View style={styles.refActions}>
            <Pressable style={[styles.actionBtn, styles.undoBtn]} onPress={() => setScore((prev) => undoPoint(prev))}>
              <Text style={styles.actionText}>{t('play.undo')}</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.resetBtn]} onPress={() => setScore(() => resetScore(score.config))}>
              <Text style={styles.actionText}>{t('play.reset')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <VictoryOverlay
        visible={Boolean(score.winner)}
        title={winnerTone ? t(winnerTone.titleKey) : t('play.victoryDefault')}
        subtitle={[
          score.winner === 'a' ? t('play.teamRedName') : t('play.teamBlueName'),
          winnerTone ? t(winnerTone.subtitleKey) : '',
        ].filter(Boolean).join(' · ')}
        scoreLine={t('play.finalScore', { score: setsPayload.map((set) => `${set.a}-${set.b}`).join(' / ') })}
        pirDelta={victoryPirDelta}
        onShare={savedInviteUrl ? shareInvite : undefined}
        shareLabel={t('play.share')}
        continueLabel={t('play.continue')}
        onContinue={closeVictory}
      />

      <QrScannerModal
        visible={qrScannerOpen}
        title={t('play.scanQr')}
        subtitle={t('play.scanPlayerQrSub')}
        onScan={onScanPlayerQr}
        onClose={() => setQrScannerOpen(false)}
      />

      <Modal visible={Boolean(pirDetail)} transparent animationType="fade" onRequestClose={() => setPirDetail(null)}>
        <View style={styles.cinematicBackdrop}>
          <View style={[styles.cinematicCard, styles.pirModal]}>
            <Text style={styles.cinematicTitle}>{t('play.detailsPir')}</Text>
            <Text style={styles.cinematicSub}>{t('play.matchLabel', { id: pirDetail?.id?.slice(-6) ?? '' })}</Text>
            {pirDetail?.pirImpact ? (
              <>
                <Text style={styles.cinematicSub}>
                  {t('play.pirDelta', {
                    delta: `${Number(pirDetail.pirImpact.delta ?? 0) > 0 ? '+' : ''}${Number(pirDetail.pirImpact.delta ?? 0).toFixed(2)}`,
                  })}
                </Text>
                {(pirDetail.pirImpact.reasons ?? []).map((line, index) => (
                  <Text key={`pir-line-${index}`} style={styles.cinematicSub}>• {line}</Text>
                ))}
                <Text style={styles.cinematicSub}>
                  {t('play.pirValidation', {
                    accepted: pirDetail?.validation?.accepted ?? 0,
                    required: pirDetail?.validation?.required ?? 0,
                  })}
                </Text>
              </>
            ) : (
              <Text style={styles.cinematicSub}>{t('play.pirWaiting')}</Text>
            )}
            <Pressable style={styles.cinematicBtn} onPress={() => setPirDetail(null)}>
              <Text style={styles.cinematicBtnText}>{t('home.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  eyebrow: { color: theme.colors.accent2, fontFamily: theme.fonts.mono, letterSpacing: 1, fontSize: 11 },
  h1: { color: theme.colors.text, fontSize: 40, lineHeight: 42, fontFamily: theme.fonts.display },
  headerSub: { color: '#BED3E1', fontFamily: theme.fonts.body, fontSize: 13, marginTop: 4, maxWidth: 320 },
  sectionTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, marginBottom: 8, fontSize: 16 },
  label: { color: theme.colors.muted, marginBottom: 4, marginTop: 4, fontFamily: theme.fonts.body },
  meta: { color: theme.colors.muted, marginBottom: 6, fontFamily: theme.fonts.body },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  rowWrap: { gap: 8, marginBottom: 8 },
  modeBtn: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
    padding: 10,
    gap: 4,
  },
  modeBtnActiveFriendly: {
    borderColor: '#2E6F5E',
    backgroundColor: '#1E5A4D',
  },
  modeBtnActiveRanked: {
    borderColor: theme.colors.accent,
    backgroundColor: '#5C4A17',
  },
  modeBtnTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 14, textTransform: 'uppercase' },
  modeBtnTitleActive: { color: '#FFF8E8' },
  modeBtnSub: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 11 },
  modeBtnSubActive: { color: '#F2E7CB' },
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
  guestInput: { minHeight: 44 },
  rowTagInput: { flex: 1, minHeight: 44 },
  tagBtn: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#2B5873',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBtnText: { color: '#EAF5FF', fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  tagBtnGhost: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4F7187',
    backgroundColor: '#173245',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagBtnGhostText: { color: '#D8EBFA', fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  guestLevels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  levelChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#476782',
    backgroundColor: '#173245',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  levelChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  levelChipText: { color: '#D5EAF8', fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase' },
  levelChipTextActive: { color: '#3A2500' },
  addGuestBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#2E6F5E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addGuestText: { color: '#ECFFF9', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 11 },
  guestBadge: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6B8BA1',
    backgroundColor: '#254A60',
  },
  guestBadgeText: { color: '#E7F5FF', fontFamily: theme.fonts.body, fontSize: 11 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
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
    marginBottom: 4,
  },
  fullBtnText: { color: '#F0F7FF', fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase' },
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
  actionBtn: { flex: 1, minHeight: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
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
  pirBox: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#36546B',
    backgroundColor: 'rgba(13, 37, 54, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  pirTitle: { color: '#F4D35E', fontFamily: theme.fonts.title, fontSize: 13 },
  pirMeta: { color: '#B9D0DD', fontFamily: theme.fonts.body, fontSize: 12 },
  pirReason: { color: '#9EB9C8', fontFamily: theme.fonts.body, fontSize: 12 },
  pirDetailBtn: {
    marginTop: 4,
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#53738A',
    backgroundColor: '#173245',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pirDetailBtnText: {
    color: '#D8EBFA',
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  fullRoot: { flex: 1, backgroundColor: '#07141F', padding: 10 },
  fullTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fullTitle: { color: '#F0F7FF', fontFamily: theme.fonts.title, fontSize: 20 },
  fullClose: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#2E4E62' },
  fullCloseText: { color: '#F0F7FF', fontFamily: theme.fonts.title },
  refControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#102331',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  refControlsLabel: { color: '#D4E2ED', fontFamily: theme.fonts.title, fontSize: 13 },
  refInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 10 },
  refInfoRowPortrait: { flexDirection: 'column', alignItems: 'center', marginBottom: 10 },
  refInfoText: { color: '#D4E2ED', fontFamily: theme.fonts.title, fontSize: 14, textAlign: 'center' },
  sideChange: { color: theme.colors.warning, fontFamily: theme.fonts.title, marginBottom: 6, textAlign: 'center' },

  refBoard: { flex: 1, gap: 8 },
  refBoardPortrait: { flexDirection: 'column' },
  refBoardLandscape: { flexDirection: 'row' },
  refSide: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  redSide: { borderColor: '#E16A6A' },
  blueSide: { borderColor: '#7FA4FF' },
  refHeadRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, minHeight: 34 },
  serviceBall: {
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: '#D3F95F',
    borderWidth: 2,
    borderColor: '#A5CC3F',
  },
  refFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  refSideTitle: {
    color: '#F8FBFF',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
  },
  refPoint: {
    color: '#FFFFFF',
    fontFamily: theme.fonts.title,
    fontSize: 120,
    lineHeight: 126,
    textAlign: 'center',
    includeFontPadding: false,
  },
  refGames: { color: '#E2E8F0', fontFamily: theme.fonts.title, fontSize: 24, textAlign: 'center' },
  refTapHint: { color: '#C8D6E3', fontFamily: theme.fonts.body, fontSize: 14, textAlign: 'center' },
  refActions: { flexDirection: 'row', gap: 10, marginTop: 8 },

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
  pirModal: {
    gap: 10,
  },
  cinematicTitle: { color: '#F4D35E', fontFamily: theme.fonts.display, fontSize: 34, lineHeight: 36 },
  cinematicTeam: { color: '#F8FBFF', fontFamily: theme.fonts.title, fontSize: 18 },
  cinematicSub: { color: '#AEC2D0', fontFamily: theme.fonts.body, textAlign: 'center' },
  cinematicBtnSecondary: {
    marginTop: 6,
    minHeight: 40,
    minWidth: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6A8BA1',
    backgroundColor: '#173246',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cinematicBtnSecondaryText: {
    color: '#D6EBF8',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  cinematicBtn: {
    marginTop: 8,
    minHeight: 44,
    minWidth: 160,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cinematicBtnText: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', letterSpacing: 1 },
});
