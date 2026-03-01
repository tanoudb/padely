import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { firstFieldError, fieldErrorsFromApiError } from '../utils/formErrors';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { useUi } from '../state/ui';
import { theme } from '../theme';

export function AuthScreen() {
  const { login, register, verifyEmail, resendVerificationCode, pendingVerification } = useSession();
  const { t, language, setLanguage } = useI18n();
  const { palette } = useUi();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('alice@padely.app');
  const [password, setPassword] = useState('padely2026');
  const [displayName, setDisplayName] = useState('Alice');
  const [verificationCode, setVerificationCode] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const titleIn = useSharedValue(0);
  const formIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const emailShake = useSharedValue(0);
  const passwordShake = useSharedValue(0);
  const displayNameShake = useSharedValue(0);
  const verificationCodeShake = useSharedValue(0);

  useEffect(() => {
    titleIn.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    formIn.value = withDelay(130, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    ctaIn.value = withDelay(250, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [ctaIn, formIn, titleIn]);

  useEffect(() => {
    if (pendingVerification?.devCode) {
      setVerificationCode(pendingVerification.devCode);
    }
  }, [pendingVerification?.devCode]);

  const titleAnimated = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ scale: interpolate(titleIn.value, [0, 1], [0.95, 1]) }],
  }));

  const formAnimated = useAnimatedStyle(() => ({
    opacity: formIn.value,
    transform: [{ translateY: interpolate(formIn.value, [0, 1], [20, 0]) }],
  }));

  const ctaAnimated = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
    transform: [{ translateY: interpolate(ctaIn.value, [0, 1], [14, 0]) }],
  }));

  function triggerShake(sharedValue) {
    sharedValue.value = withSequence(
      withTiming(-10, { duration: 45 }),
      withTiming(9, { duration: 45 }),
      withTiming(-6, { duration: 40 }),
      withTiming(4, { duration: 36 }),
      withTiming(0, { duration: 34 })
    );
  }

  const emailShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: emailShake.value }],
  }));
  const passwordShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: passwordShake.value }],
  }));
  const displayNameShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: displayNameShake.value }],
  }));
  const verificationCodeShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: verificationCodeShake.value }],
  }));

  function clearErrors() {
    setFieldErrors({});
    setGlobalError('');
  }

  async function submitAuth() {
    clearErrors();
    setNotice('');
    try {
      if (isRegister) {
        const out = await register(
          email.trim(),
          password,
          displayName.trim() || 'Player',
          { level: 4, quizAnswers: null }
        );
        if (out?.requiresEmailVerification) {
          setNotice(t('auth.msgCodeSent'));
        }
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      const nextFieldErrors = fieldErrorsFromApiError(e);
      setFieldErrors(nextFieldErrors);
      if (nextFieldErrors.email) triggerShake(emailShake);
      if (nextFieldErrors.password) triggerShake(passwordShake);
      if (nextFieldErrors.displayName) triggerShake(displayNameShake);
      if (!Object.keys(nextFieldErrors).length) {
        setGlobalError(e.message);
      }
    }
  }

  async function submitVerification() {
    clearErrors();
    setNotice('');
    if (!verificationCode.trim()) {
      setFieldErrors({ code: 'Code requis' });
      triggerShake(verificationCodeShake);
      return;
    }
    try {
      await verifyEmail(verificationCode);
    } catch (e) {
      const nextFieldErrors = fieldErrorsFromApiError(e);
      const codeError = firstFieldError(nextFieldErrors, ['code', 'token']);
      if (codeError) {
        setFieldErrors({ code: codeError });
        triggerShake(verificationCodeShake);
      } else {
        setGlobalError(e.message);
      }
    }
  }

  async function resendCode() {
    clearErrors();
    setNotice('');
    try {
      const out = await resendVerificationCode();
      if (out?.devCode) {
        setVerificationCode(out.devCode);
      }
      setNotice(t('auth.msgCodeResent'));
    } catch (e) {
      setGlobalError(e.message);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Animated.View style={titleAnimated}>
            <Text style={[styles.brand, { color: palette.accent }]}>PADELY</Text>
            <Text style={[styles.tagline, { color: palette.textSecondary ?? palette.muted }]}>Ta performance, sublimee.</Text>
          </Animated.View>

          {pendingVerification ? (
            <Animated.View style={formAnimated}>
              <View style={[styles.verifyCard, { backgroundColor: palette.bgAlt, borderColor: palette.lineMedium ?? palette.line }]}>
                <Text style={[styles.verifyTitle, { color: palette.text }]}>{t('auth.verifyPending')}</Text>
                <Text style={[styles.verifyMeta, { color: palette.textSecondary ?? palette.muted }]}>
                  {t('auth.account', { email: pendingVerification.maskedEmail ?? pendingVerification.email })}
                </Text>
                <Animated.View style={verificationCodeShakeStyle}>
                  <TextInput
                    value={verificationCode}
                    onChangeText={(value) => {
                      setVerificationCode(value);
                      setFieldErrors((prev) => ({ ...prev, code: '' }));
                    }}
                    style={[styles.input, { color: palette.text, borderColor: fieldErrors.code ? palette.danger : (palette.lineMedium ?? palette.line), backgroundColor: palette.bgElevated ?? palette.cardStrong }]}
                    placeholder={t('auth.otpPlaceholder')}
                    placeholderTextColor={palette.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </Animated.View>
                {!!fieldErrors.code ? (
                  <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.code}</Text>
                ) : null}
                <View style={styles.verifyActions}>
                  <Pressable style={[styles.primaryBtnSmall, { backgroundColor: palette.accent }]} onPress={submitVerification}>
                    <Text style={[styles.primaryBtnText, { color: palette.accentText ?? '#09090B' }]}>{t('auth.verifyEmail')}</Text>
                  </Pressable>
                  <Pressable style={[styles.secondaryBtnSmall, { borderColor: palette.accent }]} onPress={resendCode}>
                    <Text style={[styles.secondaryBtnText, { color: palette.accent }]}>{t('auth.resend')}</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.form, formAnimated]}>
            <Animated.View style={emailShakeStyle}>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                autoCapitalize="none"
                style={[styles.input, { color: palette.text, borderColor: fieldErrors.email ? palette.danger : (palette.lineMedium ?? palette.line), backgroundColor: palette.bgElevated ?? palette.cardStrong }]}
                placeholder={t('auth.email')}
                placeholderTextColor={palette.muted}
              />
            </Animated.View>
            {!!fieldErrors.email ? <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.email}</Text> : null}
            <Animated.View style={passwordShakeStyle}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                secureTextEntry
                style={[styles.input, { color: palette.text, borderColor: fieldErrors.password ? palette.danger : (palette.lineMedium ?? palette.line), backgroundColor: palette.bgElevated ?? palette.cardStrong }]}
                placeholder={t('auth.password')}
                placeholderTextColor={palette.muted}
              />
            </Animated.View>
            {!!fieldErrors.password ? <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.password}</Text> : null}
            {isRegister ? (
              <>
                <Animated.View style={displayNameShakeStyle}>
                  <TextInput
                    value={displayName}
                    onChangeText={(value) => {
                      setDisplayName(value);
                      setFieldErrors((prev) => ({ ...prev, displayName: '' }));
                    }}
                    style={[styles.input, { color: palette.text, borderColor: fieldErrors.displayName ? palette.danger : (palette.lineMedium ?? palette.line), backgroundColor: palette.bgElevated ?? palette.cardStrong }]}
                    placeholder={t('auth.displayName')}
                    placeholderTextColor={palette.muted}
                  />
                </Animated.View>
                {!!fieldErrors.displayName ? (
                  <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.displayName}</Text>
                ) : null}
              </>
            ) : null}
          </Animated.View>

          {!!globalError ? <Text style={[styles.error, { color: palette.warning }]}>{globalError}</Text> : null}
          {!!notice ? <Text style={[styles.notice, { color: palette.accent2 }]}>{notice}</Text> : null}

          <Animated.View style={ctaAnimated}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: palette.accent }]} onPress={submitAuth}>
              <Text style={[styles.primaryBtnText, { color: palette.accentText ?? '#09090B' }]}>
                {isRegister ? t('auth.createProfile') : t('auth.enter')}
              </Text>
            </Pressable>

            <Pressable style={styles.switchLine} onPress={() => setIsRegister((v) => !v)}>
              <Text style={[styles.switchText, { color: palette.textSecondary ?? palette.muted }]}>
                {isRegister ? 'Deja inscrit ? Connexion' : 'Nouveau ici ? Inscription'}
              </Text>
            </Pressable>
          </Animated.View>

          <View style={styles.langRow}>
            <Pressable onPress={() => setLanguage('fr')}>
              <Text style={[styles.lang, { color: language === 'fr' ? palette.accent : palette.muted }]}>FR</Text>
            </Pressable>
            <Text style={[styles.langDot, { color: palette.muted }]}>·</Text>
            <Pressable onPress={() => setLanguage('en')}>
              <Text style={[styles.lang, { color: language === 'en' ? palette.accent : palette.muted }]}>EN</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 16,
  },
  brand: {
    fontFamily: theme.fonts.display,
    fontSize: 52,
    letterSpacing: 12,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
    fontSize: 15,
  },
  verifyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  verifyTitle: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  verifyMeta: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  form: {
    gap: 10,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: theme.fonts.body,
  },
  error: {
    fontFamily: theme.fonts.body,
    textAlign: 'center',
    fontSize: 12,
    minHeight: 18,
  },
  notice: {
    fontFamily: theme.fonts.body,
    textAlign: 'center',
    fontSize: 12,
    minHeight: 18,
  },
  fieldError: {
    marginTop: -3,
    marginBottom: 2,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnSmall: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryBtnSmall: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  switchLine: {
    marginTop: 12,
    alignItems: 'center',
  },
  switchText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  lang: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  langDot: {
    fontSize: 14,
  },
});
