import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useI18n } from '../../state/i18n';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';
import { addPoint, createScoreState, getCurrentServer, getDisplayPoints, scoreStateToSets, undoPoint } from '../../utils/scoring';
import { scoreConfigFromSetup, slotDisplayName } from './playConfig';

function ServiceIndicator({ color, accent, surface }) {
  return (
    <View style={[styles.serviceBadge, { backgroundColor: surface }]}>
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Circle cx="9" cy="9" r="8" stroke={accent} strokeWidth="1.6" fill="none" />
        <Path d="M4.7 9.8L7.3 12.3L13.4 6.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function TeamHalf({ title, scorePoint, games, serving, onPress, colors, scaleValue, flashValue, pointSize, palette, hint }) {
  const scoreAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));
  const flashAnimated = useAnimatedStyle(() => ({
    opacity: flashValue.value,
  }));

  return (
    <Pressable onPress={onPress} style={styles.half}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <Animated.View pointerEvents="none" style={[styles.flash, { backgroundColor: palette.accentMuted }, flashAnimated]} />
      <View style={styles.topRow}>
        <Text style={[styles.teamTitle, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
        {serving ? <ServiceIndicator color={palette.text} accent={palette.accent} surface={palette.bgAlt} /> : null}
      </View>
      <Animated.Text style={[styles.point, { fontSize: pointSize, color: palette.text }, scoreAnimated]}>
        {scorePoint}
      </Animated.Text>
      <View style={styles.halfBottom}>
        <Text style={[styles.games, { color: palette.textSecondary }]}>{hint}: {games}</Text>
      </View>
    </Pressable>
  );
}

function alphaHex(hex, alpha) {
  const raw = String(hex ?? '').replace('#', '').trim();
  if (raw.length !== 6) return `rgba(255,255,255,${alpha})`;
  const int = Number.parseInt(raw, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
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

  const gradients = useMemo(() => ({
    a: [
      alphaHex(palette.danger, palette.key === 'night' ? 0.46 : 0.2),
      alphaHex(palette.bgAlt, 0.96),
    ],
    b: [
      alphaHex(palette.info, palette.key === 'night' ? 0.38 : 0.16),
      alphaHex(palette.bgAlt, 0.96),
    ],
  }), [palette]);

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
      aFlash.value = 0.6;
      aFlash.value = withTiming(0, { duration: 280 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    if (score.currentSet.b > prev.b) {
      bFlash.value = 0.6;
      bFlash.value = withTiming(0, { duration: 280 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    previousGamesRef.current = { a: score.currentSet.a, b: score.currentSet.b };
  }, [aFlash, bFlash, score.currentSet.a, score.currentSet.b]);

  useEffect(() => {
    if (!oddGamesInSet || (score.currentSet.a + score.currentSet.b) === 0) {
      setSideHint('');
      return;
    }
    setSideHint(t('play.sideChange'));
    const timer = setTimeout(() => setSideHint(''), 1200);
    return () => clearTimeout(timer);
  }, [oddGamesInSet, score.currentSet.a, score.currentSet.b, t]);

  function animatePoint(side) {
    const targetScale = side === 'a' ? aScale : bScale;
    targetScale.value = withSequence(
      withTiming(1.13, { duration: 95 }),
      withSpring(1, { damping: 15, stiffness: 150, mass: 0.8 })
    );
  }

  function scorePoint(side) {
    if (score.winner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    animatePoint(side);
    setScore((prev) => addPoint(prev, side));
  }

  const pointSize = landscape ? 142 : 126;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.bg }]}>
      <LinearGradient
        pointerEvents="none"
        colors={[palette.accentMuted, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.ambient}
      />
      <View style={styles.header}>
        <Text style={[styles.headerLabel, { color: palette.muted }]}>{t('play.referee')}</Text>
        <Text style={[styles.headerMeta, { color: palette.textSecondary ?? palette.muted }]}>
          {displayPoints.tieBreak ? t('play.tieBreakOn') : t('play.standardGame')}
        </Text>
        {!!sideHint ? <Text style={[styles.sideHint, { color: palette.accent }]}>{sideHint}</Text> : null}
      </View>
      <View style={[styles.board, landscape ? styles.boardLandscape : styles.boardPortrait]}>
        <TeamHalf
          title={teamAName}
          scorePoint={displayPoints.a}
          games={score.currentSet.a}
          serving={currentServer === 'a'}
          onPress={() => scorePoint('a')}
          colors={gradients.a}
          scaleValue={aScale}
          flashValue={aFlash}
          pointSize={pointSize}
          palette={palette}
          hint={t('play.games')}
        />
        <TeamHalf
          title={teamBName}
          scorePoint={displayPoints.b}
          games={score.currentSet.b}
          serving={currentServer === 'b'}
          onPress={() => scorePoint('b')}
          colors={gradients.b}
          scaleValue={bScale}
          flashValue={bFlash}
          pointSize={pointSize}
          palette={palette}
          hint={t('play.games')}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: palette.line, backgroundColor: palette.bgAlt }]}>
        <Text style={[styles.sets, { color: palette.textSecondary ?? palette.muted }]}>
          {t('play.setsLabel')}: {setsLine || t('play.noSets')}
        </Text>
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: palette.cardStrong, borderColor: palette.lineMedium }]} onPress={() => setScore((prev) => undoPoint(prev))}>
            <Text style={[styles.actionText, { color: palette.text }]}>{t('play.undo')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: palette.cardStrong, borderColor: palette.lineMedium }]}
            onPress={() => {
              winnerPushedRef.current = false;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setScore(createScoreState(score.config));
            }}
          >
            <Text style={[styles.actionText, { color: palette.text }]}>{t('play.reset')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ambient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    gap: 4,
  },
  headerLabel: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  headerMeta: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  board: { flex: 1, gap: 10, paddingHorizontal: 10, paddingBottom: 10 },
  boardLandscape: { flexDirection: 'row' },
  boardPortrait: { flexDirection: 'column' },
  half: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 20,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  serviceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamTitle: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontSize: 14,
    flex: 1,
  },
  point: {
    fontFamily: theme.fonts.display,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 132,
  },
  halfBottom: { alignItems: 'center', gap: 4 },
  games: { fontFamily: theme.fonts.title, fontSize: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  sets: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },
  sideHint: {
    fontFamily: theme.fonts.title,
    textAlign: 'center',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionText: { fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 },
});
