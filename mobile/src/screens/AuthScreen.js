import React, { useEffect, useState } from 'react';
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

  const brandIn = useSharedValue(0);
  const cardIn = useSharedValue(0);
  const controlsIn = useSharedValue(0);
  const emailShake = useSharedValue(0);
  const passwordShake = useSharedValue(0);
  const displayNameShake = useSharedValue(0);
  const verificationCodeShake = useSharedValue(0);

  useEffect(() => {
    brandIn.value = 0;
    cardIn.value = 0;
    controlsIn.value = 0;
    brandIn.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    cardIn.value = withDelay(220, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
    controlsIn.value = withDelay(520, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [brandIn, cardIn, controlsIn, pendingVerification, isRegister]);

  useEffect(() => {
    if (pendingVerification?.devCode) {
      setVerificationCode(pendingVerification.devCode);
    }
  }, [pendingVerification?.devCode]);

  const brandAnimated = useAnimatedStyle(() => ({
    opacity: brandIn.value,
    transform: [
      { translateY: interpolate(brandIn.value, [0, 1], [20, 0]) },
      { scale: interpolate(brandIn.value, [0, 1], [0.98, 1]) },
    ],
  }));

  const cardAnimated = useAnimatedStyle(() => ({
    opacity: cardIn.value,
    transform: [{ translateY: interpolate(cardIn.value, [0, 1], [24, 0]) }],
  }));

  const controlsAnimated = useAnimatedStyle(() => ({
    opacity: controlsIn.value,
    transform: [{ translateY: interpolate(controlsIn.value, [0, 1], [20, 0]) }],
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
          null
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
      setFieldErrors({ code: t('auth.msgCodeRequired') });
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
      <View style={[styles.bgAccentGlow, { backgroundColor: palette.accentMuted }]} />
      <View style={[styles.bgTopShade, { backgroundColor: palette.bgAlt }]} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <Animated.View style={brandAnimated}>
            <Text style={[styles.brand, { color: palette.accent }]}>PADELY</Text>
            <Text style={[styles.tagline, { color: palette.textSecondary ?? palette.muted }]}>{t('auth.tagline')}</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              cardAnimated,
              { backgroundColor: palette.cardGlass ?? palette.bgAlt, borderColor: palette.lineMedium ?? palette.line },
            ]}
          >
            <View style={styles.modeRow}>
              <Pressable
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: !isRegister ? palette.accentMuted : 'transparent',
                    borderColor: !isRegister ? palette.accent : palette.lineMedium ?? palette.line,
                  },
                ]}
                onPress={() => setIsRegister(false)}
              >
                <Text style={[styles.modeText, { color: !isRegister ? palette.accent : palette.textSecondary ?? palette.muted }]}>
                  {t('auth.login')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: isRegister ? palette.accentMuted : 'transparent',
                    borderColor: isRegister ? palette.accent : palette.lineMedium ?? palette.line,
                  },
                ]}
                onPress={() => setIsRegister(true)}
              >
                <Text style={[styles.modeText, { color: isRegister ? palette.accent : palette.textSecondary ?? palette.muted }]}>
                  {t('auth.register')}
                </Text>
              </Pressable>
            </View>

            {pendingVerification ? (
              <View style={styles.verifyBlock}>
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
                    style={[
                      styles.input,
                      {
                        color: palette.text,
                        borderColor: fieldErrors.code ? palette.danger : palette.lineMedium ?? palette.line,
                        backgroundColor: palette.bgElevated ?? palette.cardStrong,
                      },
                    ]}
                    placeholder={t('auth.otpPlaceholder')}
                    placeholderTextColor={palette.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </Animated.View>
                {!!fieldErrors.code ? <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.code}</Text> : null}
                <Pressable style={[styles.primaryBtn, { backgroundColor: palette.accent }]} onPress={submitVerification}>
                  <Text style={[styles.primaryBtnText, { color: palette.accentText ?? '#09090B' }]}>{t('auth.verifyEmail')}</Text>
                </Pressable>
                <View style={styles.verifyActions}>
                  <Pressable style={[styles.secondaryBtn, { borderColor: palette.accent }]} onPress={resendCode}>
                    <Text style={[styles.secondaryBtnText, { color: palette.accent }]}>{t('auth.resend')}</Text>
                  </Pressable>
                  <Pressable style={styles.ghostBtn} onPress={() => setIsRegister(false)}>
                    <Text style={[styles.ghostBtnText, { color: palette.textSecondary ?? palette.muted }]}>
                      {t('auth.backToAuth')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.form}>
                <Animated.View style={emailShakeStyle}>
                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setFieldErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      {
                        color: palette.text,
                        borderColor: fieldErrors.email ? palette.danger : palette.lineMedium ?? palette.line,
                        backgroundColor: palette.bgElevated ?? palette.cardStrong,
                      },
                    ]}
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
                    style={[
                      styles.input,
                      {
                        color: palette.text,
                        borderColor: fieldErrors.password ? palette.danger : palette.lineMedium ?? palette.line,
                        backgroundColor: palette.bgElevated ?? palette.cardStrong,
                      },
                    ]}
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
                        style={[
                          styles.input,
                          {
                            color: palette.text,
                            borderColor: fieldErrors.displayName ? palette.danger : palette.lineMedium ?? palette.line,
                            backgroundColor: palette.bgElevated ?? palette.cardStrong,
                          },
                        ]}
                        placeholder={t('auth.displayName')}
                        placeholderTextColor={palette.muted}
                      />
                    </Animated.View>
                    {!!fieldErrors.displayName ? (
                      <Text style={[styles.fieldError, { color: palette.danger }]}>{fieldErrors.displayName}</Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            )}
          </Animated.View>

          {!!globalError ? <Text style={[styles.error, { color: palette.warning }]}>{globalError}</Text> : null}
          {!!notice ? <Text style={[styles.notice, { color: palette.accent2 }]}>{notice}</Text> : null}

          <Animated.View style={[styles.controls, controlsAnimated]}>
            {!pendingVerification ? (
              <Pressable style={[styles.primaryBtn, { backgroundColor: palette.accent }]} onPress={submitAuth}>
                <Text style={[styles.primaryBtnText, { color: palette.accentText ?? '#09090B' }]}>
                  {isRegister ? t('auth.createProfile') : t('auth.enter')}
                </Text>
              </Pressable>
            ) : null}

            {!pendingVerification ? (
              <Pressable style={styles.ghostBtn} onPress={() => setIsRegister((v) => !v)}>
                <Text style={[styles.ghostBtnText, { color: palette.textSecondary ?? palette.muted }]}>
                  {isRegister ? t('auth.switchToLogin') : t('auth.switchToRegister')}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.langRow}>
              <Pressable
                style={[styles.langPill, { borderColor: language === 'fr' ? palette.accent : palette.lineMedium ?? palette.line }]}
                onPress={() => setLanguage('fr')}
              >
                <Text style={[styles.lang, { color: language === 'fr' ? palette.accent : palette.muted }]}>FR</Text>
              </Pressable>
              <Pressable
                style={[styles.langPill, { borderColor: language === 'en' ? palette.accent : palette.lineMedium ?? palette.line }]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.lang, { color: language === 'en' ? palette.accent : palette.muted }]}>EN</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 14,
  },
  bgAccentGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -130,
    right: -90,
  },
  bgTopShade: {
    position: 'absolute',
    width: '100%',
    height: 220,
    opacity: 0.22,
  },
  brand: {
    fontFamily: theme.fonts.display,
    fontSize: 54,
    letterSpacing: 8,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  verifyBlock: {
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
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 12,
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
    marginBottom: 4,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  controls: {
    gap: 12,
  },
  primaryBtn: {
    minHeight: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  secondaryBtn: {
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
    letterSpacing: 0.9,
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  ghostBtn: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  langPill: {
    minWidth: 48,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lang: {
    fontFamily: theme.fonts.title,
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
