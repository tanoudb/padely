import { useEffect, useState } from 'react';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
};

export function useStaggeredEntry(index = 0, enabled = true) {
  const reveal = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withDelay(
      Math.max(0, index) * 90,
      withSpring(1, SPRING),
    );
  }, [enabled, index, reveal]);

  return useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * 20 },
      { scale: 0.98 + reveal.value * 0.02 },
    ],
  }));
}

export function useScaleBounce(trigger, amplitude = 0.08) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (trigger === undefined || trigger === null) return;
    scale.value = withSequence(
      withTiming(1 + amplitude, { duration: 120, easing: Easing.out(Easing.cubic) }),
      withSpring(1, SPRING),
    );
  }, [amplitude, scale, trigger]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(Math.round(Number(target) || 0));
  const value = useSharedValue(Number(target) || 0);

  useEffect(() => {
    const to = Number(target) || 0;
    value.value = withTiming(to, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [duration, target, value]);

  useAnimatedReaction(
    () => Math.round(value.value),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setDisplay)(next);
      }
    },
    [value],
  );

  return display;
}

export function usePulseLoop() {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 760, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 760, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  return useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));
}

export const AnimatedView = Animated.View;
