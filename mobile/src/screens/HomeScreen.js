import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

function rankFromRating(rating) {
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

export function HomeScreen() {
  const { token, user, logout, updateSettings } = useSession();
  const [dashboard, setDashboard] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointRule, setPointRule] = useState(user.settings?.pointRule ?? 'punto_de_oro');
  const [matchFormat, setMatchFormat] = useState(user.settings?.matchFormat ?? 'marathon');
  const [publicProfile, setPublicProfile] = useState(Boolean(user.privacy?.publicProfile ?? true));
  const [showGuestMatches, setShowGuestMatches] = useState(Boolean(user.privacy?.showGuestMatches ?? false));
  const [showHealthStats, setShowHealthStats] = useState(Boolean(user.privacy?.showHealthStats ?? true));
  const [saveFeedback, setSaveFeedback] = useState('');

  useEffect(() => {
    api.dashboard(token, user.id).then(setDashboard).catch(() => {});
  }, [token, user.id]);

  useEffect(() => {
    setPointRule(user.settings?.pointRule ?? 'punto_de_oro');
    setMatchFormat(user.settings?.matchFormat ?? 'marathon');
    setPublicProfile(Boolean(user.privacy?.publicProfile ?? true));
    setShowGuestMatches(Boolean(user.privacy?.showGuestMatches ?? false));
    setShowHealthStats(Boolean(user.privacy?.showHealthStats ?? true));
  }, [user.settings, user.privacy]);

  const rating = dashboard?.rating ?? user.rating ?? 1200;
  const pir = dashboard?.pir ?? user.pir ?? 50;
  const wins = dashboard?.wins ?? 0;
  const losses = dashboard?.losses ?? 0;
  const matches = dashboard?.matches ?? 0;

  const winRate = useMemo(() => {
    if (!matches) return 0;
    return Math.round((wins / matches) * 100);
  }, [wins, matches]);

  async function savePrefs() {
    setSaveFeedback('');
    try {
      await updateSettings({
        settings: {
          pointRule,
          matchFormat,
          autoSideSwitch: true,
        },
        privacy: {
          publicProfile,
          showGuestMatches,
          showHealthStats,
        },
      });
      setSaveFeedback('Preferences enregistrees.');
    } catch (e) {
      setSaveFeedback(e.message);
    }
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>CENTRE PADELY</Text>
            <Text style={styles.h1}>Salut {user.displayName}</Text>
          </View>
          <Pressable style={styles.gearBtn} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>

        <Card elevated style={styles.hero}>
          <Text style={styles.heroLabel}>PIR EN DIRECT</Text>
          <Text style={styles.heroValue}>{Math.round(pir)}</Text>
          <Text style={styles.heroMeta}>Rang {rankFromRating(rating)} · Classement {Math.round(rating)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(8, Math.min(100, pir))}%` }]} />
          </View>
        </Card>

        <View style={styles.grid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Victoires</Text>
            <Text style={styles.metricValue}>{wins}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Defaites</Text>
            <Text style={styles.metricValue}>{losses}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Taux de victoire</Text>
            <Text style={styles.metricValue}>{winRate}%</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={styles.metricLabel}>Matchs</Text>
            <Text style={styles.metricValue}>{matches}</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Objectif du mois</Text>
          <Text style={styles.sectionText}>Atteindre Argent I: encore {Math.max(0, 1500 - Math.round(rating))} pts.</Text>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Focus coaching</Text>
          <Text style={styles.sectionText}>Travail prioritaire: endurance en fin de set + routine punto de oro.</Text>
        </Card>

        <Pressable style={styles.logout} onPress={logout}>
          <Text style={styles.logoutLabel}>Quitter la session</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Parametres jeu & confidentialite</Text>

            <Text style={styles.modalLabel}>Regle a 40-40</Text>
            <View style={styles.choiceRow}>
              <Pressable
                style={[styles.choiceBtn, pointRule === 'punto_de_oro' && styles.choiceBtnActive]}
                onPress={() => setPointRule('punto_de_oro')}
              >
                <Text style={[styles.choiceText, pointRule === 'punto_de_oro' && styles.choiceTextActive]}>Punto de Oro</Text>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, pointRule === 'avantage' && styles.choiceBtnActive]}
                onPress={() => setPointRule('avantage')}
              >
                <Text style={[styles.choiceText, pointRule === 'avantage' && styles.choiceTextActive]}>Avantage</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Format de match</Text>
            <View style={styles.choiceWrap}>
              {[
                { key: 'standard', label: 'Standard' },
                { key: 'club', label: 'Club' },
                { key: 'marathon', label: 'Marathon' },
              ].map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.choiceBtnWide, matchFormat === item.key && styles.choiceBtnActive]}
                  onPress={() => setMatchFormat(item.key)}
                >
                  <Text style={[styles.choiceText, matchFormat === item.key && styles.choiceTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Profil public</Text>
              <Switch value={publicProfile} onValueChange={setPublicProfile} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Afficher matchs avec invites</Text>
              <Switch value={showGuestMatches} onValueChange={setShowGuestMatches} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Partager stats sante</Text>
              <Switch value={showHealthStats} onValueChange={setShowHealthStats} />
            </View>

            {!!saveFeedback && <Text style={styles.feedback}>{saveFeedback}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtn} onPress={savePrefs}>
                <Text style={styles.modalBtnText}>Enregistrer</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setSettingsOpen(false)}>
                <Text style={[styles.modalBtnText, styles.modalBtnGhostText]}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eyebrow: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    letterSpacing: 1,
    fontSize: 11,
  },
  h1: {
    color: theme.colors.text,
    fontSize: 40,
    lineHeight: 42,
    fontFamily: theme.fonts.display,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2B5873',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearText: { color: '#EAF5FF', fontSize: 20 },
  hero: {
    gap: 4,
  },
  heroLabel: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
  },
  heroValue: {
    color: theme.colors.text,
    fontSize: 68,
    lineHeight: 70,
    fontFamily: theme.fonts.display,
  },
  heroMeta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    marginBottom: 8,
  },
  progressTrack: {
    height: 12,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#143246',
  },
  progressFill: {
    height: 12,
    backgroundColor: theme.colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    gap: 2,
  },
  metricLabel: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  metricValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 28,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 16,
    marginBottom: 6,
  },
  sectionText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  logout: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 43, 60, 0.7)',
  },
  logoutLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 19, 0.84)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F2433',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#375E76',
    padding: 14,
    gap: 10,
  },
  modalTitle: { color: theme.colors.text, fontFamily: theme.fonts.title, fontSize: 16 },
  modalLabel: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#456880',
    backgroundColor: '#173245',
  },
  choiceBtnWide: {
    minHeight: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#456880',
    backgroundColor: '#173245',
    paddingHorizontal: 10,
  },
  choiceBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  choiceText: { color: '#D8EBFA', fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase' },
  choiceTextActive: { color: '#3A2500' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#D8EBFA', fontFamily: theme.fonts.body, fontSize: 12 },
  feedback: { color: theme.colors.warning, fontFamily: theme.fonts.body, fontSize: 12 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  modalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnGhost: { backgroundColor: '#29495F' },
  modalBtnText: { color: '#3A2500', fontFamily: theme.fonts.title, textTransform: 'uppercase', fontSize: 12 },
  modalBtnGhostText: { color: '#EAF5FF' },
});
