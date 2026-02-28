import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { Backdrop } from '../components/Backdrop';
import { useSession } from '../state/session';
import { theme } from '../theme';

export function AuthScreen() {
  const { login, register } = useSession();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('alice@padely.app');
  const [password, setPassword] = useState('padely2026');
  const [displayName, setDisplayName] = useState('Alice');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    try {
      if (isRegister) {
        await register(email.trim(), password, displayName.trim() || 'Player');
      } else {
        await login(email.trim(), password);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={styles.hero}>
        <Text style={styles.kicker}>PADEL IMPACT SYSTEM</Text>
        <Text style={styles.title}>PADELY</Text>
        <Text style={styles.subtitle}>Ton niveau n est plus un chiffre. C est un ADN.</Text>
      </View>

      <Card style={styles.form} elevated>
        <View style={styles.switch}>
          <Pressable style={[styles.switchBtn, !isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(false)}>
            <Text style={[styles.switchLabel, !isRegister && styles.switchLabelActive]}>Login</Text>
          </Pressable>
          <Pressable style={[styles.switchBtn, isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(true)}>
            <Text style={[styles.switchLabel, isRegister && styles.switchLabelActive]}>Inscription</Text>
          </Pressable>
        </View>

        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} placeholder="Email" placeholderTextColor={theme.colors.muted} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Password" placeholderTextColor={theme.colors.muted} />

        {isRegister ? (
          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder="Display name" placeholderTextColor={theme.colors.muted} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.cta} onPress={submit}>
          <Text style={styles.ctaLabel}>{isRegister ? 'CREER MON PROFIL' : 'ENTRER DANS L ARENA'}</Text>
        </Pressable>

        <Text style={styles.hint}>Demo: alice@padely.app / padely2026</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: 20,
    justifyContent: 'center',
    gap: 14,
  },
  hero: {
    marginBottom: 6,
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
  form: {
    gap: 10,
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
  },
  hint: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    marginTop: 2,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.body,
  },
});
