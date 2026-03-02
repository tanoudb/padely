import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PirGauge } from './PirGauge';
import { useUi } from '../state/ui';
import { theme } from '../theme';

export function VictoryOverlay({
  visible,
  title,
  subtitle,
  scoreLine,
  pirDelta = 0,
  pirValue = 1200,
  rankLabel = 'Classement',
  isVictory = true,
  onShare,
  shareLabel,
  replayLabel,
  homeLabel,
  onReplay,
  onHome,
}) {
  const { palette } = useUi();
  const backdrop = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const deltaAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [displayDelta, setDisplayDelta] = useState(0);

  useEffect(() => {
    const id = count.addListener(({ value }) => {
      setDisplayDelta(Math.round(value));
    });
    return () => {
      count.removeListener(id);
    };
  }, [count]);

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      titleAnim.setValue(0);
      subtitleAnim.setValue(0);
      scoreAnim.setValue(0);
      gaugeAnim.setValue(0);
      deltaAnim.setValue(0);
      actionsAnim.setValue(0);
      count.setValue(0);
      setDisplayDelta(0);
      return;
    }

    Animated.sequence([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scoreAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(gaugeAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(count, {
        toValue: pirDelta,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(deltaAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(actionsAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, pirDelta, backdrop, titleAnim, subtitleAnim, scoreAnim, gaugeAnim, deltaAnim, actionsAnim, count]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <View style={styles.backdropGlow} />
        <View style={[styles.ambientOrb, styles.ambientOrbLeft, { backgroundColor: palette.accentMuted }]} />
        <View style={[styles.ambientOrb, styles.ambientOrbRight, { backgroundColor: palette.accent2Muted }]} />

        <View style={[styles.card, { backgroundColor: palette.cardStrong, borderColor: palette.lineStrong }]}>
          <Animated.Text
            style={[
              styles.title,
              {
                color: isVictory ? palette.accent : palette.text,
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            {title}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.subtitle,
              {
                color: palette.textSecondary ?? palette.muted,
                opacity: subtitleAnim,
                transform: [{ translateY: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            {subtitle}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.score,
              {
                color: palette.text,
                opacity: scoreAnim,
                transform: [{ scale: scoreAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
              },
            ]}
          >
            {scoreLine}
          </Animated.Text>

          <Animated.View
            style={[
              styles.gaugeWrap,
              {
                opacity: gaugeAnim,
                transform: [{ scale: gaugeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              },
            ]}
          >
            <PirGauge pir={pirValue} delta={pirDelta} rank={rankLabel} />
          </Animated.View>

          <Animated.Text
            style={[
              styles.delta,
              {
                color: pirDelta >= 0 ? palette.accent2 : palette.danger,
                opacity: deltaAnim,
                transform: [{ translateY: deltaAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
          >
            PIR {displayDelta >= 0 ? '+' : ''}{displayDelta}
          </Animated.Text>

          <Animated.View style={{ width: '100%', opacity: actionsAnim }}>
            {onShare ? (
              <Pressable style={[styles.shareBtn, { borderColor: palette.line, backgroundColor: palette.card }]} onPress={onShare}>
                <Text style={[styles.shareText, { color: palette.text }]}>{shareLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable style={[styles.mainBtn, { backgroundColor: palette.accent }]} onPress={onReplay}>
              <Text style={[styles.mainBtnText, { color: palette.accentText }]}>{replayLabel}</Text>
            </Pressable>

            <Pressable style={styles.ghostBtn} onPress={onHome}>
              <Text style={[styles.ghostBtnText, { color: palette.textSecondary ?? palette.muted }]}>{homeLabel}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#050507',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(212, 168, 83, 0.08)',
  },
  ambientOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  ambientOrbLeft: {
    left: -42,
    top: 90,
  },
  ambientOrbRight: {
    right: -42,
    bottom: 140,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 44,
    lineHeight: 46,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
    textAlign: 'center',
  },
  score: {
    marginTop: 2,
    fontFamily: theme.fonts.mono,
    fontSize: 28,
    letterSpacing: 1.1,
  },
  gaugeWrap: {
    marginTop: 2,
    width: '100%',
    alignItems: 'center',
  },
  delta: {
    marginTop: 2,
    fontFamily: theme.fonts.display,
    fontSize: 34,
    lineHeight: 36,
  },
  shareBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 8,
  },
  shareText: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  mainBtn: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtnText: {
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  ghostBtn: {
    marginTop: 10,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
});
