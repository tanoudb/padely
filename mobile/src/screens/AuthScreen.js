import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { Backdrop } from '../components/Backdrop';
import { useSession } from '../state/session';
import { theme } from '../theme';

const LEVEL_DESCRIPTIONS = {
  1: 'Debutant absolu',
  2: 'Bases en cours',
  3: 'Echanges simples',
  4: 'Jeu complet',
  5: 'Jeu structure',
  6: 'Competition locale',
  7: 'Competition regionale',
  8: 'Niveau elite',
};

const QUIZ = [
  { key: 'vitres', label: 'Utilisation des vitres' },
  { key: 'filet', label: 'Montee au filet' },
  { key: 'tournoi', label: 'Experience tournoi' },
  { key: 'technique', label: 'Maitrise technique' },
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
  const { login, register } = useSession();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('alice@padely.app');
  const [password, setPassword] = useState('padely2026');
  const [displayName, setDisplayName] = useState('Alice');
  const [unknownLevel, setUnknownLevel] = useState(false);
  const [level, setLevel] = useState(4);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [error, setError] = useState('');

  const quizReady = useMemo(() => QUIZ.every((q) => quizAnswers[q.key]), [quizAnswers]);

  async function submit() {
    setError('');
    try {
      if (isRegister) {
        if (unknownLevel && !quizReady) {
          throw new Error('Complete le quiz pour estimer ton niveau.');
        }

        const finalLevel = unknownLevel ? inferLevelFromQuiz(quizAnswers) : level;
        await register(
          email.trim(),
          password,
          displayName.trim() || 'Player',
          {
            level: finalLevel,
            quizAnswers: unknownLevel ? quizAnswers : null,
          }
        );
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
        <Text style={styles.kicker}>SYSTEME D IMPACT PADEL</Text>
        <Text style={styles.title}>PADELY</Text>
        <Text style={styles.subtitle}>Ton niveau n est plus un chiffre. C est un ADN.</Text>
      </View>

      <Card style={styles.form} elevated>
        <View style={styles.switch}>
          <Pressable style={[styles.switchBtn, !isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(false)}>
            <Text style={[styles.switchLabel, !isRegister && styles.switchLabelActive]}>Connexion</Text>
          </Pressable>
          <Pressable style={[styles.switchBtn, isRegister && styles.switchBtnActive]} onPress={() => setIsRegister(true)}>
            <Text style={[styles.switchLabel, isRegister && styles.switchLabelActive]}>Inscription</Text>
          </Pressable>
        </View>

        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} placeholder="Email" placeholderTextColor={theme.colors.muted} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Mot de passe" placeholderTextColor={theme.colors.muted} />

        {isRegister ? (
          <>
            <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} placeholder="Nom affiche" placeholderTextColor={theme.colors.muted} />

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Je ne connais pas mon niveau</Text>
              <Pressable
                style={[styles.smallToggle, unknownLevel && styles.smallToggleActive]}
                onPress={() => setUnknownLevel((v) => !v)}
              >
                <Text style={[styles.smallToggleText, unknownLevel && styles.smallToggleTextActive]}>{unknownLevel ? 'Oui' : 'Non'}</Text>
              </Pressable>
            </View>

            {!unknownLevel ? (
              <>
                <Text style={styles.cardLabel}>Niveau (1 a 8)</Text>
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
                <Text style={styles.hint}>{LEVEL_DESCRIPTIONS[level]}</Text>
              </>
            ) : (
              <>
                <Text style={styles.cardLabel}>Quiz d auto-evaluation (1 a 5)</Text>
                {QUIZ.map((q) => (
                  <View key={q.key} style={styles.quizRow}>
                    <Text style={styles.quizLabel}>{q.label}</Text>
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
                <Text style={styles.hint}>Niveau estime: {inferLevelFromQuiz(quizAnswers)} / 8</Text>
              </>
            )}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.cta} onPress={submit}>
          <Text style={styles.ctaLabel}>{isRegister ? 'Creer mon profil' : 'Entrer dans l espace de jeu'}</Text>
        </Pressable>

        <Text style={styles.hint}>Compte test: alice@padely.app / padely2026</Text>
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
