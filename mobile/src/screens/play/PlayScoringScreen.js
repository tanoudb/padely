import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useI18n } from '../../state/i18n';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';
import { addPoint, createScoreState, getCurrentServer, getDisplayPoints, scoreStateToSets, undoPoint } from '../../utils/scoring';
import { scoreConfigFromSetup, slotDisplayName } from './playConfig';

function TeamHalf({
  title,
  scorePoint,
  games,
  serving,
  onPress,
  colors,
  scaleValue,
  flashValue,
  pointSize,
}) {
  const scoreAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));
  const flashAnimated = useAnimatedStyle(() => ({
    opacity: flashValue.value,
  }));

  return (
    <Pressable onPress={onPress} style={styles.half}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Animated.View pointerEvents="none" style={[styles.flash, flashAnimated]} />
      <Text style={styles.teamTitle}>{title}</Text>
      <Animated.Text style={[styles.point, { fontSize: pointSize }, scoreAnimated]}>
        {scorePoint}
      </Animated.Text>
      <View style={styles.halfBottom}>
        <Text style={styles.games}>Jeux {games}</Text>
        {serving ? <Text style={styles.service}>Service</Text> : <Text style={styles.serviceOff}> </Text>}
      </View>
    </Pressable>
  );
}

export function PlayScoringScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useI18n();
  const { palette } = useUi();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const setup = route.params?.setup;

  const [score, setScore] = useState(() => createScoreState(scoreConfigFromSetup(setup)));
  const [sideHint, setSideHint] = useState('');
  const winnerPushedRef = useRef(false);
  const previousGamesRef = useRef({ a: 0, b: 0 });

  const aScale = useSharedValue(1);
  const bScale = useSharedValue(1);
  const aFlash = useSharedValue(0);
  const bFlash = useSharedValue(0);

  const displayPoints = getDisplayPoints(score);
  const currentServer = getCurrentServer(score);
  const setsLine = score.sets.map((set) => `${set.a}-${set.b}`).join(' · ');
  const oddGamesInSet = (score.currentSet.a + score.currentSet.b) % 2 === 1;

  const teamAName = useMemo(() => {
    const partner = setup?.selectedSlots?.[0];
    return `${setup?.participants?.[setup?.userId] ?? 'Toi'} + ${slotDisplayName(partner, setup?.participants)}`;
  }, [setup]);

  const teamBName = useMemo(() => {
    const one = setup?.selectedSlots?.[1];
    const two = setup?.selectedSlots?.[2];
    return `${slotDisplayName(one, setup?.participants)} + ${slotDisplayName(two, setup?.participants)}`;
  }, [setup]);

  useEffect(() => {
    if (!score.winner || winnerPushedRef.current) return;
    winnerPushedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const payload = {
      setup,
      winner: score.winner,
      sets: scoreStateToSets(score),
      endedAt: new Date().toISOString(),
    };
    navigation.replace('PlayResult', payload);
  }, [navigation, score, setup]);

  useEffect(() => {
    const prev = previousGamesRef.current;
    if (score.currentSet.a > prev.a) {
      aFlash.value = 0.45;
      aFlash.value = withTiming(0, { duration: 300 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    if (score.currentSet.b > prev.b) {
      bFlash.value = 0.45;
      bFlash.value = withTiming(0, { duration: 300 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    previousGamesRef.current = { a: score.currentSet.a, b: score.currentSet.b };
  }, [aFlash, bFlash, score.currentSet.a, score.currentSet.b]);

  useEffect(() => {
    if (!oddGamesInSet || (score.currentSet.a + score.currentSet.b) === 0) {
      setSideHint('');
      return;
    }
    setSideHint('Changement de cote');
    const timer = setTimeout(() => setSideHint(''), 1200);
    return () => clearTimeout(timer);
  }, [oddGamesInSet, score.currentSet.a, score.currentSet.b]);

  function animatePoint(side) {
    const targetScale = side === 'a' ? aScale : bScale;
    targetScale.value = withSequence(
      withTiming(1.12, { duration: 110 }),
      withTiming(1, { duration: 130 })
    );
  }

  function scorePoint(side) {
    if (score.winner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animatePoint(side);
    setScore((prev) => addPoint(prev, side));
  }

  const pointSize = landscape ? 128 : 102;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.board, landscape ? styles.boardLandscape : styles.boardPortrait]}>
        <TeamHalf
          title={teamAName}
          scorePoint={displayPoints.a}
          games={score.currentSet.a}
          serving={currentServer === 'a'}
          onPress={() => scorePoint('a')}
          colors={palette.key === 'night' ? ['#1A0A0A', '#230D0D'] : ['#FEF2F2', '#FDE5E5']}
          scaleValue={aScale}
          flashValue={aFlash}
          pointSize={pointSize}
        />
        <TeamHalf
          title={teamBName}
          scorePoint={displayPoints.b}
          games={score.currentSet.b}
          serving={currentServer === 'b'}
          onPress={() => scorePoint('b')}
          colors={palette.key === 'night' ? ['#0A0A1A', '#101024'] : ['#EFF6FF', '#E4F0FF']}
          scaleValue={bScale}
          flashValue={bFlash}
          pointSize={pointSize}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: palette.line }]}>
        <Text style={[styles.sets, { color: palette.textSecondary ?? palette.muted }]}>
          {displayPoints.tieBreak ? 'Tie-break actif' : 'Jeu standard'} · {setsLine || 'Set 1 en cours'}
        </Text>
        {!!sideHint ? <Text style={[styles.sideHint, { color: palette.accent }]}>{sideHint}</Text> : null}
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: palette.cardStrong }]} onPress={() => setScore((prev) => undoPoint(prev))}>
            <Text style={[styles.actionText, { color: palette.text }]}>Undo</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: palette.cardStrong }]}
            onPress={() => {
              winnerPushedRef.current = false;
              setScore(createScoreState(score.config));
            }}
          >
            <Text style={[styles.actionText, { color: palette.text }]}>Reset</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  board: { flex: 1, gap: 8, padding: 8 },
  boardLandscape: { flexDirection: 'row' },
  boardPortrait: { flexDirection: 'column' },
  half: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212, 168, 83, 0.2)',
  },
  teamTitle: {
    color: '#FAFAFA',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 14,
  },
  point: {
    color: '#FAFAFA',
    fontFamily: theme.fonts.display,
    textAlign: 'center',
    includeFontPadding: false,
  },
  halfBottom: { alignItems: 'center', gap: 4 },
  games: { color: '#D4D4D8', fontFamily: theme.fonts.title, fontSize: 18 },
  service: { color: '#D4A853', fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  serviceOff: { fontSize: 12 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  sets: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },
  sideHint: {
    fontFamily: theme.fonts.title,
    textAlign: 'center',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 },
});
