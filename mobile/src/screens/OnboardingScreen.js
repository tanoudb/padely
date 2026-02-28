import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

const LEVEL_DESCRIPTIONS = {
  1: 'Debutant absolu',
  2: 'Bases en cours',
  3: 'Echanges simples',
  4: 'Jeu complet avec transitions',
  5: 'Jeu structure et tactique',
  6: 'Bon niveau competition locale',
  7: 'Tres bon niveau regional',
  8: 'Elite',
};

const QUESTIONS = [
  {
    key: 'vitres',
    title: 'Utilisation des vitres',
    options: ['Rarement', 'Parfois', 'Souvent'],
  },
  {
    key: 'filet',
    title: 'Montee au filet',
    options: ['Peu', 'Reguliere', 'Maitrisee'],
  },
  {
    key: 'tournoi',
    title: 'Pratique en tournoi',
    options: ['Jamais', 'Occasionnel', 'Frequent'],
  },
  {
    key: 'technique',
    title: 'Maitrise technique',
    options: ['En apprentissage', 'Correcte', 'Avancee'],
  },
];

export function OnboardingScreen() {
  const { token, user, setUser } = useSession();
  const [level, setLevel] = useState(4);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const allAnswered = useMemo(() => QUESTIONS.every((q) => answers[q.key]), [answers]);

  async function submit() {
    setError('');
    setSaving(true);
    try {
      const profile = await api.completeOnboarding(token, {
        level,
        quizAnswers: answers,
      });
      setUser(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ONBOARDING EXPERT</Text>
      <Text style={styles.title}>Bienvenue {user?.displayName}</Text>

      <Card elevated>
        <Text style={styles.cardTitle}>Niveau initial (1 a 8)</Text>
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
        <Text style={styles.meta}>Selection: Niveau {level} - {LEVEL_DESCRIPTIONS[level]}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Quiz d auto-evaluation</Text>
        {QUESTIONS.map((question) => (
          <View key={question.key} style={styles.questionBlock}>
            <Text style={styles.questionTitle}>{question.title}</Text>
            <View style={styles.optionsRow}>
              {question.options.map((option) => {
                const active = answers[question.key] === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => setAnswers((prev) => ({ ...prev, [question.key]: option }))}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </Card>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.cta, (!allAnswered || saving) && styles.ctaDisabled]}
        onPress={submit}
        disabled={!allAnswered || saving}
      >
        <Text style={styles.ctaLabel}>{saving ? 'Validation...' : 'Valider le profil'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  eyebrow: { color: theme.colors.accent2, fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.display, fontSize: 42, lineHeight: 44 },
  cardTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 16, marginBottom: 10 },
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  levelChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.chip,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  levelChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  levelText: { color: theme.colors.text, fontFamily: theme.fonts.title },
  levelTextActive: { color: '#3A2500' },
  meta: { color: theme.colors.muted, fontFamily: theme.fonts.body },
  questionBlock: { marginBottom: 12 },
  questionTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, marginBottom: 8 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
  },
  optionActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  optionText: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 12 },
  optionTextActive: { color: '#3A2500', fontFamily: theme.fonts.title },
  cta: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaLabel: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', letterSpacing: 1 },
  error: { color: theme.colors.danger, fontFamily: theme.fonts.body },
});
