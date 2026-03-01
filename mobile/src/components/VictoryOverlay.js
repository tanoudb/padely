import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function makePieces() {
  return Array.from({ length: 28 }).map((_, index) => ({
    id: index,
    left: 8 + Math.random() * 84,
    size: 6 + Math.random() * 8,
    delay: Math.random() * 450,
    duration: 900 + Math.random() * 1100,
    rotate: `${Math.round(Math.random() * 120 - 60)}deg`,
    color: ['#F4D35E', '#00D1B2', '#E5544B', '#7FA4FF'][Math.floor(Math.random() * 4)],
  }));
}

export function VictoryOverlay({
  visible,
  title,
  subtitle,
  scoreLine,
  pirDelta = 0,
  onShare,
  shareLabel,
  continueLabel,
  onContinue,
}) {
  const { palette } = useUi();
  const rise = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const confetti = useRef(new Animated.Value(0)).current;
  const [displayDelta, setDisplayDelta] = useState(0);
  const pieces = useMemo(() => makePieces(), []);

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
      rise.setValue(0);
      confetti.setValue(0);
      count.setValue(0);
      setDisplayDelta(0);
      return;
    }

    Animated.parallel([
      Animated.spring(rise, {
        toValue: 1,
        bounciness: 14,
        speed: 11,
        useNativeDriver: true,
      }),
      Animated.timing(confetti, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(count, {
        toValue: pirDelta,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [visible, pirDelta, rise, confetti, count]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        {pieces.map((piece) => (
          <Animated.View
            key={piece.id}
            style={[
              styles.confetti,
              {
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.3,
                backgroundColor: piece.color,
                transform: [
                  { rotate: piece.rotate },
                  {
                    translateY: confetti.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-260 - piece.delay, 420 + piece.delay],
                    }),
                  },
                ],
                opacity: confetti.interpolate({
                  inputRange: [0, 0.12, 0.9, 1],
                  outputRange: [0, 0.9, 0.9, 0],
                }),
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: palette.cardStrong,
              borderColor: palette.accent,
              transform: [
                {
                  translateY: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [140, 0],
                  }),
                },
                {
                  scale: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
              opacity: rise,
            },
          ]}
        >
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
          <Text style={[styles.score, { color: palette.text }]}>{scoreLine}</Text>
          <Text style={[styles.delta, { color: pirDelta >= 0 ? palette.accent2 : palette.danger }]}>
            PIR {displayDelta >= 0 ? '+' : ''}{displayDelta}
          </Text>

          {onShare ? (
            <Pressable style={[styles.shareBtn, { borderColor: palette.line }]} onPress={onShare}>
              <Text style={[styles.shareText, { color: palette.text }]}>{shareLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable style={[styles.mainBtn, { backgroundColor: palette.accent }]} onPress={onContinue}>
            <Text style={styles.mainBtnText}>{continueLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confetti: {
    position: 'absolute',
    top: -20,
    borderRadius: 3,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 2,
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
    fontFamily: theme.fonts.title,
    fontSize: 16,
  },
  delta: {
    marginTop: 8,
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
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBtnText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
});
