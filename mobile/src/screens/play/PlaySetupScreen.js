import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../../components/Card';
import { api } from '../../api/client';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';

function userChipLabel(player) {
  return `${player.displayName} · ${Math.round(player.rating ?? 0)}`;
}

export function PlaySetupScreen() {
  const navigation = useNavigation();
  const { token, user } = useSession();
  const { palette } = useUi();

  const [players, setPlayers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [matchMode, setMatchMode] = useState(user.settings?.defaultMatchMode === 'friendly' ? 'friendly' : 'ranked');
  const [matchFormat, setMatchFormat] = useState(user.settings?.matchFormat ?? 'marathon');
  const [pointRule, setPointRule] = useState(user.settings?.pointRule ?? 'punto_de_oro');
  const [totalCost, setTotalCost] = useState('48');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    api.listPlayers(token)
      .then((out) => setPlayers(out.filter((p) => p.id !== user.id)))
      .catch((e) => setFeedback(e.message));
  }, [token, user.id]);

  const selectedSlots = useMemo(() => ([
    ...selectedUsers,
    ...guests.map((g) => ({
      kind: 'guest',
      guestId: g.id,
      guestName: g.name,
      guestLevel: g.level ?? 'Intermediaire',
    })),
  ]), [selectedUsers, guests]);

  const participants = useMemo(() => {
    const map = { [user.id]: user.displayName };
    for (const player of players) {
      map[player.id] = player.displayName;
    }
    for (const g of guests) {
      map[g.id] = g.name;
    }
    return map;
  }, [guests, players, user.displayName, user.id]);

  function setMatchModeSafe(next) {
    setMatchMode(next);
    if (next === 'ranked' && guests.length) {
      setGuests([]);
      setFeedback('Mode classe: invites retires automatiquement.');
    }
  }

  function toggleUser(playerId) {
    setSelectedUsers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length + guests.length >= 3) {
        return prev;
      }
      return [...prev, playerId];
    });
  }

  function addGuest() {
    if (matchMode === 'ranked') {
      setFeedback('Mode classe: invites non autorises.');
      return;
    }
    const safeName = guestName.trim();
    if (!safeName) {
      setFeedback('Entre un nom invite.');
      return;
    }
    if (selectedUsers.length + guests.length >= 3) {
      setFeedback('Tu as deja 3 joueurs selectionnes.');
      return;
    }

    setGuests((prev) => [...prev, {
      id: `guest_${Date.now()}_${Math.round(Math.random() * 1000)}`,
      name: safeName,
      level: 'Intermediaire',
    }]);
    setGuestName('');
    setFeedback('');
  }

  function removeGuest(guestId) {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  }

  function launchMatch() {
    if (selectedSlots.length !== 3) {
      setFeedback('Mode 2v2: ajoute 3 joueurs en plus de toi.');
      return;
    }

    const setup = {
      userId: user.id,
      participants,
      selectedSlots,
      matchMode,
      matchFormat,
      pointRule,
      totalCostEur: Number(totalCost) || 0,
      startedAt: new Date().toISOString(),
    };
    navigation.navigate('PlayScoring', { setup });
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>MATCH</Text>
        <Text style={[styles.pitch, { color: palette.textSecondary ?? palette.muted }]}>Configure ton match, puis lance le scoring live.</Text>
      </View>

      <Card elevated>
        <Text style={[styles.section, { color: palette.textSecondary ?? palette.muted }]}>MODE</Text>
        <View style={styles.row}>
          <Pressable
            style={[
              styles.modeBtn,
              { borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt },
              matchMode === 'ranked' && { borderColor: palette.accent, backgroundColor: palette.accentMuted },
            ]}
            onPress={() => setMatchModeSafe('ranked')}
          >
            <Text style={[styles.modeTitle, { color: palette.text }]}>Classe</Text>
            <Text style={[styles.modeSub, { color: palette.muted }]}>PIR actif</Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeBtn,
              { borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt },
              matchMode === 'friendly' && { borderColor: palette.accent, backgroundColor: palette.accentMuted },
            ]}
            onPress={() => setMatchModeSafe('friendly')}
          >
            <Text style={[styles.modeTitle, { color: palette.text }]}>Amical</Text>
            <Text style={[styles.modeSub, { color: palette.muted }]}>Invites autorises</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={[styles.section, { color: palette.textSecondary ?? palette.muted }]}>JOUEURS</Text>
        <Text style={[styles.meta, { color: palette.muted }]}>Ordre: partenaire rouge, puis equipe bleue.</Text>
        <View style={styles.wrap}>
          {players.map((player) => {
            const active = selectedUsers.includes(player.id);
            return (
              <Pressable
                key={player.id}
                style={[
                  styles.chip,
                  { backgroundColor: palette.bgAlt, borderColor: palette.lineMedium ?? palette.line },
                  active && { backgroundColor: palette.accentMuted, borderColor: palette.accent },
                ]}
                onPress={() => toggleUser(player.id)}
              >
                <Text style={[styles.chipText, { color: palette.text }]}>{userChipLabel(player)}</Text>
              </Pressable>
            );
          })}
        </View>

        {matchMode === 'friendly' ? (
          <View style={styles.guestRow}>
            <TextInput
              style={[styles.input, { color: palette.text, borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt }]}
              placeholder="Nom invite"
              placeholderTextColor={palette.muted}
              value={guestName}
              onChangeText={setGuestName}
            />
            <Pressable style={[styles.guestBtn, { backgroundColor: palette.cardStrong }]} onPress={addGuest}>
              <Text style={[styles.guestBtnText, { color: palette.text }]}>Ajouter</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.wrap}>
          {guests.map((g) => (
            <Pressable key={g.id} onPress={() => removeGuest(g.id)} style={[styles.chip, { backgroundColor: palette.accentMuted, borderColor: palette.accent }]}>
              <Text style={[styles.chipText, { color: palette.text }]}>{g.name} ✕</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.meta, { color: palette.muted }]}>Selection: {selectedSlots.length}/3</Text>
      </Card>

      <Card>
        <Text style={[styles.section, { color: palette.textSecondary ?? palette.muted }]}>REGLES</Text>
        <View style={styles.row}>
          {[
            { key: 'punto_de_oro', label: 'Punto de Oro' },
            { key: 'avantage', label: 'Avantage' },
          ].map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.smallChoice,
                { borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt },
                pointRule === option.key && { borderColor: palette.accent, backgroundColor: palette.accentMuted },
              ]}
              onPress={() => setPointRule(option.key)}
            >
              <Text style={[styles.smallChoiceText, { color: palette.text }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {[
            { key: 'standard', label: 'Standard' },
            { key: 'club', label: 'Club' },
            { key: 'marathon', label: 'Marathon' },
          ].map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.smallChoice,
                { borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt },
                matchFormat === option.key && { borderColor: palette.accent, backgroundColor: palette.accentMuted },
              ]}
              onPress={() => setMatchFormat(option.key)}
            >
              <Text style={[styles.smallChoiceText, { color: palette.text }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={[styles.input, { color: palette.text, borderColor: palette.lineMedium ?? palette.line, backgroundColor: palette.bgAlt }]}
          placeholder="Cout terrain (EUR)"
          placeholderTextColor={palette.muted}
          keyboardType="numeric"
          value={totalCost}
          onChangeText={setTotalCost}
        />
      </Card>

      {!!feedback ? <Text style={[styles.feedback, { color: palette.warning }]}>{feedback}</Text> : null}

      <Pressable
        style={[
          styles.launchBtn,
          { backgroundColor: selectedSlots.length === 3 ? palette.accent : palette.cardStrong, opacity: selectedSlots.length === 3 ? 1 : 0.6 },
        ]}
        onPress={launchMatch}
      >
        <Text style={[styles.launchText, { color: palette.accentText ?? '#09090B' }]}>LANCER LE MATCH</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  header: { gap: 4 },
  title: { fontFamily: theme.fonts.display, fontSize: 42, lineHeight: 44, letterSpacing: 0.6 },
  pitch: { fontFamily: theme.fonts.body, fontSize: 13 },
  section: { fontFamily: theme.fonts.title, fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeBtn: { flex: 1, minHeight: 84, borderWidth: 1, borderRadius: 16, padding: 12, justifyContent: 'space-between' },
  modeTitle: { fontFamily: theme.fonts.title, fontSize: 16 },
  modeSub: { fontFamily: theme.fonts.body, fontSize: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 12 },
  chipText: { fontFamily: theme.fonts.title, fontSize: 11 },
  meta: { marginTop: 8, fontFamily: theme.fonts.body, fontSize: 12 },
  guestRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8 },
  input: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, fontFamily: theme.fonts.body },
  guestBtn: { minWidth: 90, borderRadius: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  guestBtnText: { fontFamily: theme.fonts.title, textTransform: 'uppercase', letterSpacing: 0.7, fontSize: 11 },
  smallChoice: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  smallChoiceText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  feedback: { fontFamily: theme.fonts.body, fontSize: 12 },
  launchBtn: { minHeight: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  launchText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.1 },
});
