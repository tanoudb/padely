import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const LEVELS = [
  { key: 'beginner', value: 2, labelKey: 'onboarding.levelBeginner', subKey: 'onboarding.levelBeginnerSub' },
  { key: 'intermediate', value: 4, labelKey: 'onboarding.levelIntermediate', subKey: 'onboarding.levelIntermediateSub' },
  { key: 'advanced', value: 6, labelKey: 'onboarding.levelAdvanced', subKey: 'onboarding.levelAdvancedSub' },
  { key: 'expert', value: 8, labelKey: 'onboarding.levelExpert', subKey: 'onboarding.levelExpertSub' },
];

export function OnboardingScreen() {
  const { token, user, setUser } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [step, setStep] = useState(0);
  const [levelKey, setLevelKey] = useState('intermediate');
  const [city, setCity] = useState(user?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const stepAnim = useSharedValue(0);

  useEffect(() => {
    stepAnim.value = withTiming(step, { duration: 220 });
  }, [step, stepAnim]);

  const panelAStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(stepAnim.value - 0), [0, 1], [1, 0.34]),
    transform: [{ translateX: (stepAnim.value - 0) * -28 }],
  }));

  const panelBStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(stepAnim.value - 1), [0, 1], [1, 0.34]),
    transform: [{ translateX: (stepAnim.value - 1) * -28 }],
  }));

  const selectedLevel = useMemo(
    () => LEVELS.find((item) => item.key === levelKey) ?? LEVELS[1],
    [levelKey],
  );

  const canNext = step === 0 ? Boolean(levelKey) : city.trim().length >= 2;
  const welcomeLine = user?.settings?.playerRhythm === 'light'
    ? t('onboarding.welcomeLight')
    : t('onboarding.welcomeAdaptive');

  async function submit() {
    if (saving || !canNext) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const profile = await api.completeOnboarding(token, {
        level: selectedLevel.value,
        city: city.trim(),
        preferences: {
          publicProfile: true,
        },
      });
      setUser(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function onNext() {
    if (!canNext) {
      return;
    }
    if (step === 0) {
      setStep(1);
      return;
    }
    submit().catch(() => {});
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.kicker, { color: palette.accent }]}>{t('onboarding.kicker')}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{t('onboarding.title', { name: user?.displayName ?? t('profile.playerFallback') })}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{t('onboarding.subtitleSimple')}</Text>
        <Text style={[styles.welcome, { color: palette.accent2 }]}>{welcomeLine}</Text>

        <View style={styles.stepsRow}>
          {[0, 1].map((index) => {
            const active = index <= step;
            return (
              <View
                key={String(index)}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: active ? palette.accent : palette.line,
                  },
                ]}
              />
            );
          })}
        </View>

        {step === 0 ? (
          <Animated.View style={panelAStyle}>
            <Card elevated>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('onboarding.stepLevelTitle')}</Text>
              <Text style={[styles.cardSub, { color: palette.textSecondary }]}>{t('onboarding.stepLevelSub')}</Text>

              <View style={styles.levelGrid}>
                {LEVELS.map((item) => {
                  const active = item.key === levelKey;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.levelBtn,
                        {
                          borderColor: active ? palette.accent : palette.line,
                          backgroundColor: active ? palette.accentMuted : palette.bgAlt,
                        },
                      ]}
                      onPress={() => setLevelKey(item.key)}
                    >
                      <Text style={[styles.levelTitle, { color: active ? palette.accent : palette.text }]}>{t(item.labelKey)}</Text>
                      <Text style={[styles.levelSub, { color: palette.textSecondary }]}>{t(item.subKey)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {step === 1 ? (
          <Animated.View style={panelBStyle}>
            <Card elevated>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('onboarding.stepCityTitle')}</Text>
              <Text style={[styles.cardSub, { color: palette.textSecondary }]}>{t('onboarding.stepCitySub')}</Text>

              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder={t('onboarding.cityPlaceholder')}
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: palette.line,
                    backgroundColor: palette.bgAlt,
                  },
                ]}
              />
            </Card>
          </Animated.View>
        ) : null}

        {!!error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

        <View style={styles.actionsRow}>
          {step > 0 ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: palette.cardStrong }]}
              onPress={() => setStep((current) => Math.max(0, current - 1))}
            >
              <Text style={[styles.actionText, { color: palette.text }]}>{t('onboarding.back')}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.actionBtn, { backgroundColor: canNext ? palette.accent : palette.cardStrong }]}
            onPress={onNext}
          >
            <Text style={[styles.actionText, { color: canNext ? palette.accentText : palette.textSecondary }]}>
              {step === 0 ? t('onboarding.next') : (saving ? t('onboarding.saving') : t('onboarding.finish'))}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  kicker: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 36,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  welcome: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  stepsRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  cardTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 16,
    marginBottom: 6,
  },
  cardSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    marginBottom: 10,
  },
  levelGrid: {
    gap: 8,
  },
  levelBtn: {
    borderWidth: 1,
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  levelTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
    marginBottom: 2,
  },
  levelSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: theme.fonts.body,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
});
