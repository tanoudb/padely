import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api/client';
import { Card } from '../components/Card';
import { useSession } from '../state/session';
import { theme } from '../theme';

function MessageRow({ item }) {
  return (
    <View style={styles.messageRow}>
      <Text style={styles.messageAuthor}>{item.senderName ?? item.fromUserId}</Text>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );
}

export function CommunityScreen() {
  const { token, user } = useSession();
  const [city, setCity] = useState(user.city ?? 'Lyon');
  const [crew, setCrew] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('france');
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelInput, setChannelInput] = useState('');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState('');

  async function refreshCrew() {
    const [crewOut, playerPool] = await Promise.all([
      api.crew(token, city),
      api.listPlayers(token),
    ]);
    setCrew(crewOut);
    setPlayers(playerPool.filter((p) => p.id !== user.id));

    const firstChannel = crewOut.channels?.[0]?.key ?? 'france';
    setSelectedChannel((prev) => prev || firstChannel);
  }

  useEffect(() => {
    refreshCrew().catch(() => {});
  }, [city, token, user.id]);

  useEffect(() => {
    if (!selectedChannel) return;
    api.channelMessages(token, selectedChannel).then(setChannelMessages).catch(() => {});
  }, [token, selectedChannel]);

  useEffect(() => {
    if (!selectedFriend) {
      setDmMessages([]);
      return;
    }
    api.privateMessages(token, selectedFriend).then(setDmMessages).catch(() => {});
  }, [token, selectedFriend]);

  const nonFriends = useMemo(() => {
    const friendSet = new Set((crew?.friends ?? []).map((f) => f.id));
    return players.filter((p) => !friendSet.has(p.id)).slice(0, 6);
  }, [crew?.friends, players]);

  async function sendChannel() {
    if (!selectedChannel || !channelInput.trim()) return;
    await api.sendChannelMessage(token, selectedChannel, channelInput.trim());
    setChannelInput('');
    const items = await api.channelMessages(token, selectedChannel);
    setChannelMessages(items);
  }

  async function sendDM() {
    if (!selectedFriend || !dmInput.trim()) return;
    await api.sendPrivateMessage(token, selectedFriend, dmInput.trim());
    setDmInput('');
    const items = await api.privateMessages(token, selectedFriend);
    setDmMessages(items);
  }

  async function addFriend(friendId) {
    await api.addFriend(token, friendId);
    await refreshCrew();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CREW</Text>
        <Text style={styles.h1}>Espace communautaire</Text>
      </View>

      <Card elevated>
        <Text style={styles.label}>Ville regionale</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={theme.colors.muted} />
      </Card>

      <Card>
        <Text style={styles.section}>Groupes de discussion</Text>
        <View style={styles.channelWrap}>
          {(crew?.channels ?? []).map((ch) => (
            <Pressable
              key={ch.key}
              style={[styles.channelChip, selectedChannel === ch.key && styles.channelChipActive]}
              onPress={() => setSelectedChannel(ch.key)}
            >
              <Text style={[styles.channelChipText, selectedChannel === ch.key && styles.channelChipTextActive]}>{ch.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.messagesBox}>
          {channelMessages.slice(-8).map((item) => (
            <MessageRow key={item.id} item={item} />
          ))}
          {channelMessages.length === 0 && <Text style={styles.sub}>Aucun message.</Text>}
        </View>

        <View style={styles.row}> 
          <TextInput
            style={[styles.input, styles.inputCompact]}
            value={channelInput}
            onChangeText={setChannelInput}
            placeholder="Message de groupe"
            placeholderTextColor={theme.colors.muted}
          />
          <Pressable style={styles.btnSmall} onPress={sendChannel}>
            <Text style={styles.btnSmallLabel}>Envoyer</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>Amis & messagerie privee</Text>
        <View style={styles.channelWrap}>
          {(crew?.friends ?? []).map((friend) => (
            <Pressable
              key={friend.id}
              style={[styles.channelChip, selectedFriend === friend.id && styles.channelChipActive]}
              onPress={() => setSelectedFriend(friend.id)}
            >
              <Text style={[styles.channelChipText, selectedFriend === friend.id && styles.channelChipTextActive]}>
                {friend.displayName}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedFriend ? (
          <>
            <View style={styles.messagesBox}>
              {dmMessages.slice(-8).map((item) => (
                <MessageRow key={item.id} item={item} />
              ))}
              {dmMessages.length === 0 && <Text style={styles.sub}>Aucun message prive.</Text>}
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.inputCompact]}
                value={dmInput}
                onChangeText={setDmInput}
                placeholder="Message prive"
                placeholderTextColor={theme.colors.muted}
              />
              <Pressable style={styles.btnSmall} onPress={sendDM}>
                <Text style={styles.btnSmallLabel}>Envoyer</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.sub}>Selectionne un ami pour ouvrir la messagerie.</Text>
        )}

        {nonFriends.length > 0 && (
          <>
            <Text style={[styles.sub, styles.mt]}>Ajouter des amis</Text>
            {nonFriends.map((p) => (
              <View key={p.id} style={styles.friendRow}>
                <Text style={styles.friendName}>{p.displayName}</Text>
                <Pressable style={styles.addBtn} onPress={() => addFriend(p.id)}>
                  <Text style={styles.addBtnLabel}>Ajouter</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.section}>Classement local {city}</Text>
        {(crew?.leaderboard ?? []).slice(0, 8).map((row) => (
          <View style={styles.rankRow} key={row.userId}>
            <Text style={styles.rankText}>#{row.rank} {row.displayName}</Text>
            <Text style={styles.rankScore}>{row.rating}</Text>
          </View>
        ))}
        {(crew?.leaderboard ?? []).length === 0 && <Text style={styles.sub}>Aucun classement.</Text>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { marginBottom: 4 },
  eyebrow: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    letterSpacing: 1,
    fontSize: 11,
  },
  h1: {
    color: theme.colors.text,
    fontSize: 36,
    lineHeight: 38,
    fontFamily: theme.fonts.display,
  },
  section: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    marginBottom: 8,
    fontSize: 16,
  },
  sub: {
    color: theme.colors.muted,
    marginBottom: 6,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  mt: { marginTop: 8 },
  label: { color: theme.colors.muted, marginBottom: 6, fontFamily: theme.fonts.body },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgAlt,
    fontFamily: theme.fonts.body,
  },
  inputCompact: {
    flex: 1,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  channelChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#456880',
    backgroundColor: '#163446',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  channelChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  channelChipText: {
    color: '#D7EBFA',
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  channelChipTextActive: { color: '#3A2500' },
  messagesBox: {
    borderWidth: 1,
    borderColor: 'rgba(157, 185, 203, 0.25)',
    backgroundColor: 'rgba(15, 42, 58, 0.7)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  messageRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.18)',
    paddingBottom: 5,
  },
  messageAuthor: { color: theme.colors.accent2, fontFamily: theme.fonts.title, fontSize: 11 },
  messageText: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 12 },
  btnSmall: {
    minWidth: 92,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  btnSmallLabel: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
  },
  friendName: { color: theme.colors.text, fontFamily: theme.fonts.body },
  addBtn: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#2E6F5E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  addBtnLabel: { color: '#ECFFF9', fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase' },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.15)',
    paddingVertical: 6,
  },
  rankText: { color: theme.colors.text, fontFamily: theme.fonts.title },
  rankScore: { color: theme.colors.accent, fontFamily: theme.fonts.mono },
});
