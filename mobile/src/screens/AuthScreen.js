import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { useI18n } from '../state/i18n';
import { Backdrop } from '../components/Backdrop';
import { useSession } from '../state/session';
import { theme } from '../theme';

const QUIZ = [
  { key: 'vitres', i18n: 'auth.quizVitres' },
  { key: 'filet', i18n: 'auth.quizFilet' },
  { key: 'tournoi', i18n: 'auth.quizTournoi' },
  { key: 'technique', i18n: 'auth.quizTechnique' },
];

function inferLevelFromQuiz(answers) {
  const values = Object.values(answers).map((v) => Number(v));
  if (!values.length) {
    return 4;
  }

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const mapped = Math.round(1 + ((avg - 1) * 7) / 4);
  return Math.max(1, Math.min(8, mapped));
}

export function AuthScreen() {
  const { login, register, verifyEmail, resendVerificationCode, pendingVerification } = useSession();
  const { t, language, setLanguage } = useI18n();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('alice@padely.app');
  const [password, setPassword] = useState('padely2026');
  const [displayName, setDisplayName] = useState('Alice');
  const [unknownLevel, setUnknownLevel] = useState(false);
  const [level, setLevel] = useState(4);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');

  const quizReady = useMemo(() => QUIZ.every((q) => quizAnswers[q.key]), [quizAnswers]);
  const levelDescriptions = useMemo(() => ({
    1: t('auth.level1'),
    2: t('auth.level2'),
    3: t('auth.level3'),
    4: t('auth.level4'),
    5: t('auth.level5'),
    6: t('auth.level6'),
    7: t('auth.level7'),
    8: t('auth.level8'),
  }), [t]);

  useEffect(() => {
    if (pendingVerification?.devCode) {
      setVerificationCode(pendingVerification.devCode);
    }
  }, [pendingVerification?.devCode]);

  async function submit() {
    setError('');
    try {
      if (isRegister) {
        if (unknownLevel && !quizReady) {
          throw new Error(t('auth.msgCompleteQuiz'));
        }

        const finalLevel = unknownLevel ? inferLevelFromQuiz(quizAnswers) : level;
        const out = await register(
          email.trim(),
          password,
          displayName.trim() || 'Player',
          {
            level: finalLevel,
            quizAnswers: unknownLevel ? quizAnswers : null,
          }
        );
        if (out.requiresEmailVerification) {
          setError(t('auth.msgCodeSent'));
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitVerification() {
    setError('');
    try {
      await verifyEmail(verificationCode);
    } catch (e) {
      setError(e.message);
    }
  }

  async function resendCode() {
    setError('');
    try {
      const out = await resendVerificationCode();
      if (out.alreadyVerified) {
        setError(t('auth.msgAlreadyVerified'));
        return;
      }
      if (out.devCode) {
        setVerificationCode(out.devCode);
      }
      setError(t('auth.msgCodeResent'));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.langRow}>
              <Pressable
                style={[styles.langBtn, language === 'fr' && styles.langBtnActive]}
                onPress={() => setLanguage('fr')}
              >
                <Text style={[styles.langBtnText, language === 'fr' && styles.langBtnTextActive]}>FR</Text>
              </Pressable>
              <Pressable
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
              </Pressable>
            </View>
            <Text style={styles.kicker}>{t('app.splashKicker')}</Text>
            <Text style={styles.title}>PADELY</Text>
            <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureChip}>{t('auth.featureLive')}</Text>
              <Text style={styles.featureChip}>{t('auth.featurePir')}</Text>
              <Text style={styles.featureChip}>{t('auth.featureCommunity')}</Text>
            </View>
          </View>

          <Card style={styles.form} elevated>
            {pendingVerification ? (
              <View style={styles.verifyBox}>
                <Text style={styles.verifyTitle}>{t('auth.verifyPending')}</Text>
                <Text style={styles.verifyText}>
                  {t('auth.account', { email: pendingVerification.maskedEmail ?? pendingVerification.email })}
                </Text>
                <Text style={styles.verifyMeta}>
                  {t('auth.otpMeta', { minutes: pendingVerification.expiresInMinutes ?? 15 })}
                </Text>
                <Text style={styles.verifyMeta}>
                  {t('auth.emailChannel', {
                    provider: pendingVerification.verificationProvider === 'none'
                      ? t('auth.notConfigured')
                      : pendingVerification.verificationProvider,
                  })}
                </Text>
                <TextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  style={styles.input}
                  placeholder={t('auth.otpPlaceholder')}
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <View style={styles.verifyActions}>
                  <Pressable style={[styles.verifyBtn, styles.verifyBtnMain]} onPress={submitVerification}>
                    <Text style={styles.verifyBtnText}>{t('auth.verifyEmail')}</Text>
                  </Pressable>
                  <Pressable style={styles.resendBtn} onPress={resendCode}>
                    <Text style={styles.resendBtnText}>{t('auth.resend')}</Text>
                  </Pressable>
                </View>
                {pendingVerification.devCode ? (
                  <Text style={styles.hint}>{t('auth.devCode', { code: pendingVerification.devCode })}</Text>
                ) : (
                  <Text style={styles.hint}>{t('auth.spamHint')}</Text>
                )}
              </View>
            ) : null}

            <View style={styles.switch}>
              <Pressable style={[styles.switchBtn, !isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(false)}>
                <Text style={[styles.switchLabel, !isRegister && styles.switchLabelActive]}>{t('auth.login')}</Text>
              </Pressable>
              <Pressable style={[styles.switchBtn, isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(true)}>
                <Text style={[styles.switchLabel, isRegister && styles.switchLabelActive]}>{t('auth.register')}</Text>
              </Pressable>
            </View>

            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} placeholder={t('auth.email')} placeholderTextColor={theme.colors.muted} />
            <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder={t('auth.password')} placeholderTextColor={theme.colors.muted} />

            {isRegister ? (
              <>
                <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder={t('auth.displayName')} placeholderTextColor={theme.colors.muted} />

                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>{t('auth.unknownLevel')}</Text>
                  <Pressable
                    style={[styles.smallToggle, unknownLevel && styles.smallToggleActive]}
                    onPress={() => setUnknownLevel((v) => !v)}
                  >
                    <Text style={[styles.smallToggleText, unknownLevel && styles.smallToggleTextActive]}>
                      {unknownLevel ? t('auth.yes') : t('auth.no')}
                    </Text>
                  </Pressable>
                </View>

                {!unknownLevel ? (
                  <>
                    <Text style={styles.cardLabel}>{t('auth.levelLabel')}</Text>
                    <View style={styles.levelGrid}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                        <Pressable
                          key={String(value)}
                          style={[styles.levelChip, value === level && styles.levelChipActive]}
                          onPress={() => setLevel(value)}
                        >
                          <Text style={[styles.levelText, value === level && styles.levelTextActive]}>{value}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.hint}>{levelDescriptions[level]}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardLabel}>{t('auth.quizLabel')}</Text>
                    {QUIZ.map((q) => (
                      <View key={q.key} style={styles.quizRow}>
                        <Text style={styles.quizLabel}>{t(q.i18n)}</Text>
                        <View style={styles.quizOptions}>
                          {[1, 2, 3, 4, 5].map((value) => {
                            const active = Number(quizAnswers[q.key]) === value;
                            return (
                              <Pressable
                                key={`${q.key}-${value}`}
                                style={[styles.quizChip, active && styles.quizChipActive]}
                                onPress={() => setQuizAnswers((prev) => ({ ...prev, [q.key]: value }))}
                              >
                                <Text style={[styles.quizChipText, active && styles.quizChipTextActive]}>{value}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                    <Text style={styles.hint}>{t('auth.quizEstimated', { level: inferLevelFromQuiz(quizAnswers) })}</Text>
                  </>
                )}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.cta} onPress={submit}>
              <Text style={styles.ctaLabel}>{isRegister ? t('auth.createProfile') : t('auth.enter')}</Text>
            </Pressable>

            <Text style={styles.hint}>{t('auth.testAccount')}</Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 14,
  },
  hero: {
    marginBottom: 6,
  },
  langRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 6,
    marginBottom: 8,
  },
  langBtn: {
    minHeight: 28,
    minWidth: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4E6F87',
    backgroundColor: 'rgba(18, 51, 72, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: '#F4D35E',
    backgroundColor: '#F4D35E',
  },
  langBtnText: {
    color: '#D8EBFA',
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  langBtnTextActive: {
    color: '#3A2500',
  },
  kicker: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    letterSpacing: 1,
    fontSize: 11,
  },
  title: {
    color: theme.colors.text,
    fontSize: 56,
    lineHeight: 58,
    fontFamily: theme.fonts.display,
    letterSpacing: 1,
  },
  subtitle: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    marginTop: 2,
  },
  featureRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4A6E86',
    backgroundColor: 'rgba(18, 51, 72, 0.66)',
    color: '#D8EBFA',
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  form: {
    gap: 10,
  },
  verifyBox: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(20, 56, 76, 0.45)',
    marginBottom: 6,
    gap: 6,
  },
  verifyTitle: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
  verifyText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  verifyMeta: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  verifyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyBtn: {
    minHeight: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnMain: {
    flex: 1,
    backgroundColor: '#2E6F5E',
  },
  verifyBtnText: {
    color: '#ECFFF9',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  resendBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  resendBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  switch: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  switchBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.chip,
  },
  switchBtnActive: {
    backgroundColor: theme.colors.accent,
  },
  switchLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  switchLabelActive: {
    color: '#3A2500',
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    color: theme.colors.text,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.bgAlt,
    fontFamily: theme.fonts.body,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  optionLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  smallToggle: {
    minHeight: 30,
    minWidth: 64,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bgAlt,
  },
  smallToggleActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  smallToggleText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 11,
  },
  smallToggleTextActive: {
    color: '#3A2500',
  },
  cardLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
  },
  levelChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  levelText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 12,
  },
  levelTextActive: {
    color: '#3A2500',
  },
  quizRow: {
    gap: 6,
    marginTop: 4,
  },
  quizLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  quizOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  quizChip: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bgAlt,
  },
  quizChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  quizChipText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 12,
  },
  quizChipTextActive: {
    color: '#3A2500',
  },
  cta: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  ctaLabel: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hint: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.body,
  },
});
