import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const SPRING = { damping: 15, stiffness: 150, mass: 0.8 };

const QUESTIONS = [
  {
    key: 'vitres',
    titleKey: 'auth.quizVitres',
    options: ['A', 'B', 'C'],
  },
  {
    key: 'filet',
    titleKey: 'auth.quizFilet',
    options: ['A', 'B', 'C'],
  },
  {
    key: 'tournoi',
    titleKey: 'auth.quizTournoi',
    options: ['A', 'B', 'C'],
  },
  {
    key: 'technique',
    titleKey: 'auth.quizTechnique',
    options: ['A', 'B', 'C'],
  },
];

export function OnboardingScreen() {
  const { token, user, setUser } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [level, setLevel] = useState(4);
  const [answers, setAnswers] = useState({});
  const [city, setCity] = useState(user?.city ?? 'Lyon');
  const [defaultMatchMode, setDefaultMatchMode] = useState('ranked');
  const [matchFormat, setMatchFormat] = useState('marathon');
  const [pointRule, setPointRule] = useState('punto_de_oro');
  const [autoSaveMatch, setAutoSaveMatch] = useState(true);
  const [notifMatchInvites, setNotifMatchInvites] = useState(true);
  const [notifLeaderboard, setNotifLeaderboard] = useState(true);
  const [notifPartnerAvailability, setNotifPartnerAvailability] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sliderStep = useSharedValue(0);

  const allAnswered = useMemo(() => QUESTIONS.every((q) => answers[q.key]), [answers]);
  const canContinue = step === 0
    ? Number(level) >= 1 && Number(level) <= 8
    : step === 1
      ? allAnswered
      : city.trim().length >= 2;
  const estimatedLevel = useMemo(() => {
    if (!allAnswered) return level;
    const score = QUESTIONS.reduce((sum, q) => {
      const answer = answers[q.key];
      if (answer === 'A') return sum + 1;
      if (answer === 'B') return sum + 2;
      if (answer === 'C') return sum + 3;
      return sum + 2;
    }, 0);
    const normalized = Math.round((score / (QUESTIONS.length * 3)) * 7) + 1;
    return Math.min(8, Math.max(1, normalized));
  }, [allAnswered, answers, level]);

  useEffect(() => {
    sliderStep.value = withSpring(step, SPRING);
  }, [sliderStep, step]);

  function panelStyle(index) {
    return useAnimatedStyle(() => {
      const relative = index - sliderStep.value;
      return {
        transform: [{ translateX: relative * width * 0.86 }],
        opacity: interpolate(Math.abs(relative), [0, 1], [1, 0.3]),
      };
    }, [index, width]);
  }

  const panel0 = panelStyle(0);
  const panel1 = panelStyle(1);
  const panel2 = panelStyle(2);

  async function submit() {
    setError('');
    setSaving(true);
    try {
      const profile = await api.completeOnboarding(token, {
        level: estimatedLevel,
        quizAnswers: answers,
        city: city.trim(),
        preferences: {
          defaultMatchMode,
          matchFormat,
          pointRule,
          autoSaveMatch,
          notifications: {
            matchInvites: notifMatchInvites,
            partnerAvailability: notifPartnerAvailability,
            leaderboardMovement: notifLeaderboard,
          },
          publicProfile,
        },
      });
      setUser(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={[styles.bgOrbTop, { backgroundColor: palette.accentMuted }]} />
      <View style={[styles.bgOrbBottom, { backgroundColor: palette.accent2Muted ?? palette.accentMuted }]} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.eyebrow, { color: palette.accent }]}>{t('onboarding.kicker')}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{t('onboarding.title', { name: user?.displayName ?? 'Player' })}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{t('onboarding.subtitle')}</Text>

        <View style={styles.dotsRow}>
          {[0, 1, 2].map((index) => {
            const active = index === step;
            return (
              <View
                key={`dot_${index}`}
                style={[
                  styles.dot,
                  {
                    width: active ? 26 : 10,
                    backgroundColor: active ? palette.accent : palette.lineMedium ?? palette.line,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.sliderWrap}>
          <Animated.View style={[styles.panel, panel0]}>
            <Card elevated style={styles.panelCard}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('onboarding.step1Title')}</Text>
              <Text style={[styles.cardSub, { color: palette.textSecondary }]}>{t('onboarding.step1Sub')}</Text>
              <View style={styles.levelGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => {
                  const active = value === level;
                  return (
                    <Pressable
                      key={String(value)}
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor: active ? palette.accent : palette.bgAlt,
                          borderColor: active ? palette.accent : palette.line,
                        },
                      ]}
                      onPress={() => setLevel(value)}
                    >
                      <Text style={[styles.levelText, { color: active ? palette.accentText : palette.text }]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                {t(`auth.level${level}`)}
              </Text>
            </Card>
          </Animated.View>

          <Animated.View style={[styles.panel, panel1]}>
            <Card elevated style={styles.panelCard}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('onboarding.step2Title')}</Text>
              <Text style={[styles.cardSub, { color: palette.textSecondary }]}>{t('onboarding.step2Sub')}</Text>
              {QUESTIONS.map((question) => (
                <View key={question.key} style={styles.questionBlock}>
                  <Text style={[styles.questionTitle, { color: palette.text }]}>{t(question.titleKey)}</Text>
                  <View style={styles.optionsRow}>
                    {question.options.map((option, optionIndex) => {
                      const active = answers[question.key] === option;
                      const optionLabel = optionIndex === 0
                        ? t('onboarding.optionLow')
                        : optionIndex === 1
                          ? t('onboarding.optionMid')
                          : t('onboarding.optionHigh');
                      return (
                        <Pressable
                          key={`${question.key}_${option}`}
                          style={[
                            styles.option,
                            {
                              borderColor: active ? palette.accent : palette.line,
                              backgroundColor: active ? palette.accentMuted : palette.bgAlt,
                            },
                          ]}
                          onPress={() => setAnswers((prev) => ({ ...prev, [question.key]: option }))}
                        >
                          <Text style={[styles.optionText, { color: active ? palette.accent : palette.textSecondary }]}>{optionLabel}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                {t('auth.quizEstimated', { level: estimatedLevel })}
              </Text>
            </Card>
          </Animated.View>

          <Animated.View style={[styles.panel, panel2]}>
            <Card elevated style={styles.panelCard}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{t('onboarding.step3Title')}</Text>
              <Text style={[styles.cardSub, { color: palette.textSecondary }]}>{t('onboarding.step3Sub')}</Text>

              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder={t('onboarding.cityPlaceholder')}
                placeholderTextColor={palette.muted}
                style={[
                  styles.cityInput,
                  {
                    color: palette.text,
                    borderColor: palette.line,
                    backgroundColor: palette.bgAlt,
                  },
                ]}
              />

              <Text style={[styles.prefLabel, { color: palette.textSecondary }]}>{t('onboarding.defaultMode')}</Text>
              <View style={styles.prefRow}>
                {['ranked', 'friendly'].map((mode) => {
                  const active = mode === defaultMatchMode;
                  return (
                    <Pressable
                      key={mode}
                      style={[
                        styles.prefChip,
                        {
                          borderColor: active ? palette.accent : palette.line,
                          backgroundColor: active ? palette.accentMuted : palette.bgAlt,
                        },
                      ]}
                      onPress={() => setDefaultMatchMode(mode)}
                    >
                      <Text style={[styles.prefChipText, { color: active ? palette.accent : palette.textSecondary }]}>
                        {mode === 'ranked' ? t('home.ranked') : t('home.friendly')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.prefLabel, { color: palette.textSecondary }]}>{t('onboarding.defaultFormat')}</Text>
              <View style={styles.prefRow}>
                {[
                  { key: 'standard', label: t('home.standard') },
                  { key: 'club', label: t('home.club') },
                  { key: 'marathon', label: t('home.marathon') },
                ].map((entry) => {
                  const active = entry.key === matchFormat;
                  return (
                    <Pressable
                      key={entry.key}
                      style={[
                        styles.prefChip,
                        {
                          borderColor: active ? palette.accent : palette.line,
                          backgroundColor: active ? palette.accentMuted : palette.bgAlt,
                        },
                      ]}
                      onPress={() => setMatchFormat(entry.key)}
                    >
                      <Text style={[styles.prefChipText, { color: active ? palette.accent : palette.textSecondary }]}>{entry.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.prefLabel, { color: palette.textSecondary }]}>{t('onboarding.pointRule')}</Text>
              <View style={styles.prefRow}>
                {[
                  { key: 'punto_de_oro', label: t('home.pointPunto') },
                  { key: 'avantage', label: t('home.pointAdv') },
                ].map((entry) => {
                  const active = entry.key === pointRule;
                  return (
                    <Pressable
                      key={entry.key}
                      style={[
                        styles.prefChip,
                        {
                          borderColor: active ? palette.accent : palette.line,
                          backgroundColor: active ? palette.accentMuted : palette.bgAlt,
                        },
                      ]}
                      onPress={() => setPointRule(entry.key)}
                    >
                      <Text style={[styles.prefChipText, { color: active ? palette.accent : palette.textSecondary }]}>{entry.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {[
                { key: 'autoSave', label: t('onboarding.autoSave'), value: autoSaveMatch, setter: setAutoSaveMatch },
                { key: 'notifMatch', label: t('onboarding.notifMatchInvites'), value: notifMatchInvites, setter: setNotifMatchInvites },
                { key: 'notifPartner', label: t('onboarding.notifPartner'), value: notifPartnerAvailability, setter: setNotifPartnerAvailability },
                { key: 'notifLeaderboard', label: t('onboarding.notifLeaderboard'), value: notifLeaderboard, setter: setNotifLeaderboard },
                { key: 'publicProfile', label: t('onboarding.publicProfile'), value: publicProfile, setter: setPublicProfile },
              ].map((row) => (
                <View key={row.key} style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: palette.text }]}>{row.label}</Text>
                  <Switch
                    value={row.value}
                    onValueChange={row.setter}
                    trackColor={{ false: palette.lineMedium ?? palette.line, true: palette.accent }}
                    thumbColor={row.value ? palette.accentText : palette.bgElevated}
                  />
                </View>
              ))}
            </Card>
          </Animated.View>
        </View>

        {!!error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          {step > 0 ? (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: palette.line, backgroundColor: palette.bgAlt }]}
              onPress={() => setStep((current) => Math.max(0, current - 1))}
              disabled={saving}
            >
              <Text style={[styles.secondaryLabel, { color: palette.textSecondary }]}>{t('onboarding.back')}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor: canContinue ? palette.accent : palette.cardStrong,
                opacity: saving ? 0.65 : 1,
              },
            ]}
            onPress={() => {
              if (!canContinue || saving) return;
              if (step < 2) {
                setStep((current) => Math.min(2, current + 1));
                return;
              }
              submit();
            }}
            disabled={!canContinue || saving}
          >
            <Text style={[styles.primaryLabel, { color: canContinue ? palette.accentText : palette.textSecondary }]}>
              {step < 2 ? t('onboarding.next') : (saving ? t('onboarding.saving') : t('onboarding.finish'))}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingTop: 34, paddingBottom: 26 },
  bgOrbTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -110,
    left: -60,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -100,
    right: -70,
  },
  eyebrow: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: { marginTop: 8, fontFamily: theme.fonts.display, fontSize: 39, lineHeight: 41 },
  subtitle: { marginTop: 6, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 18 },
  dotsRow: { marginTop: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 10, borderRadius: 9 },
  sliderWrap: {
    width: '100%',
    minHeight: 560,
    overflow: 'hidden',
    position: 'relative',
  },
  panel: {
    width: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  panelCard: {
    minHeight: 560,
  },
  cardTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardSub: {
    marginTop: 4,
    marginBottom: 12,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  levelChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  levelText: { fontFamily: theme.fonts.title, fontSize: 18 },
  meta: { marginTop: 8, fontFamily: theme.fonts.body, fontSize: 13 },
  questionBlock: { marginBottom: 14 },
  questionTitle: { fontFamily: theme.fonts.title, marginBottom: 8, fontSize: 14 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: {
    minHeight: 34,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: { fontFamily: theme.fonts.body, fontSize: 12 },
  cityInput: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  prefLabel: { marginTop: 12, marginBottom: 8, fontFamily: theme.fonts.title, fontSize: 12, letterSpacing: 0.5 },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prefChip: {
    minHeight: 36,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefChipText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.55 },
  switchRow: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { fontFamily: theme.fonts.body, fontSize: 13 },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: theme.fonts.title, textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  error: { marginTop: 10, fontFamily: theme.fonts.body },
});
