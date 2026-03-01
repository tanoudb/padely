import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL, api } from '../api/client';
import { Card } from '../components/Card';
import { QrScannerModal } from '../components/QrScannerModal';
import { useI18n } from '../state/i18n';
import { useSession } from '../state/session';
import { theme } from '../theme';
import { createCommunitySubscription } from '../utils/communityStream';

const CITY_PRESETS = ['Lyon', 'Paris', 'Marseille', 'Bordeaux', 'Toulouse', 'Lille'];

const TOP_TABS = [
  { key: 'home', i18n: 'community.tabsHome' },
  { key: 'regional', i18n: 'community.tabsRegional' },
  { key: 'channels', i18n: 'community.tabsChannels' },
  { key: 'clubs', i18n: 'community.tabsClubs' },
];

function initials(name) {
  const safe = String(name ?? '').trim();
  if (!safe) return '??';
  const parts = safe.split(' ').filter(Boolean);
  if (parts.length === 1) return safe.slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function greetingLine(name, t) {
  const hour = new Date().getHours();
  const firstName = String(name ?? 'Champion').trim().split(' ')[0] || 'Champion';
  if (hour < 12) return t('community.greetingMorning', { name: firstName });
  if (hour < 18) return t('community.greetingAfternoon', { name: firstName });
  return t('community.greetingEvening', { name: firstName });
}

function Avatar({ name, active = false }) {
  return (
    <View style={[styles.avatar, active && styles.avatarActive]}>
      <Text style={[styles.avatarText, active && styles.avatarTextActive]}>{initials(name)}</Text>
    </View>
  );
}

function ChannelPill({ label, active, onPress }) {
  return (
    <Pressable style={[styles.channelPill, active && styles.channelPillActive]} onPress={onPress}>
      <Text style={[styles.channelPillText, active && styles.channelPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PostCard({ item, mine, t }) {
  return (
    <Card style={styles.postCard}>
      <View style={styles.postHead}>
        <View style={styles.postAuthorWrap}>
          <Avatar name={item.senderName} active={mine} />
          <View>
            <Text style={styles.postAuthor}>{mine ? t('community.me') : item.senderName}</Text>
            <Text style={styles.postMeta}>{item.channelLabel} · {formatTime(item.createdAt)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.postText}>{item.text}</Text>
    </Card>
  );
}

function DmBubble({ mine, text, createdAt }) {
  return (
    <View style={[styles.dmBubble, mine ? styles.dmBubbleMine : styles.dmBubbleOther]}>
      <Text style={styles.dmBubbleText}>{text}</Text>
      <Text style={styles.dmTime}>{formatTime(createdAt)}</Text>
    </View>
  );
}

function messageKey(item, index, prefix = 'msg') {
  const base = item?.id
    ?? `${item?.channel ?? 'ch'}_${item?.senderId ?? 'u'}_${item?.createdAt ?? 't'}_${(item?.text ?? '').slice(0, 24)}`;
  return `${prefix}_${base}_${index}`;
}

function clubCodeFromQrValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  if (value.startsWith('padely://club/')) {
    return decodeURIComponent(value.slice('padely://club/'.length)).trim();
  }

  if (value.startsWith('PADELY_CLUB:')) {
    return value.slice('PADELY_CLUB:'.length).trim();
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const url = new URL(value);
      const qpCode = url.searchParams.get('code');
      if (qpCode) return qpCode.trim();
      const chunks = url.pathname.split('/').filter(Boolean);
      if (chunks.length >= 2 && chunks[chunks.length - 2] === 'club') {
        return decodeURIComponent(chunks[chunks.length - 1]).trim();
      }
    } catch {
      return value;
    }
  }

  return value;
}

export function CommunityScreen() {
  const route = useRoute();
  const isFocused = useIsFocused();
  const { token, user } = useSession();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState('home');
  const [city, setCity] = useState(user.city ?? 'Lyon');
  const [isLocating, setIsLocating] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const [crew, setCrew] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState('');

  const [selectedRegionalChannel, setSelectedRegionalChannel] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('france');
  const [selectedClubChannel, setSelectedClubChannel] = useState('');
  const [channelCache, setChannelCache] = useState({});
  const [channelPaging, setChannelPaging] = useState({});
  const [dmPaging, setDmPaging] = useState({ hasMore: false, nextCursor: null, loading: false });
  const streamRef = useRef(null);

  const [homeInput, setHomeInput] = useState('');
  const [regionalInput, setRegionalInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [clubInput, setClubInput] = useState('');

  const [newChannelName, setNewChannelName] = useState('');
  const [clubCode, setClubCode] = useState('');
  const [clubQrOpen, setClubQrOpen] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => greetingLine(user.displayName, t), [user.displayName, t]);
  const routeFriendId = route.params?.friendId ? String(route.params.friendId) : '';
  const routeCity = route.params?.city ? String(route.params.city) : '';

  async function detectCityFromLocation() {
    setIsLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const guess = geo?.[0]?.city || geo?.[0]?.subregion || geo?.[0]?.region;
      if (guess) {
        setCity(guess);
      }
    } catch {
      // Silent fallback on manual city chips.
    } finally {
      setIsLocating(false);
    }
  }

  async function refreshChannelMessages(channelKey, options = {}) {
    if (!channelKey) return;
    try {
      const page = await api.channelMessagesPage(token, channelKey, {
        limit: options.limit ?? 40,
        before: options.before,
        markRead: options.markRead ? 1 : undefined,
      });
      setChannelCache((prev) => {
        const current = prev[channelKey] ?? [];
        if (options.append) {
          const seen = new Set(current.map((item) => item.id));
          const merged = [...page.items, ...current].filter((item) => {
            if (!item?.id) return true;
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          return { ...prev, [channelKey]: merged };
        }
        return { ...prev, [channelKey]: page.items ?? [] };
      });
      setChannelPaging((prev) => ({
        ...prev,
        [channelKey]: {
          hasMore: Boolean(page.hasMore),
          nextCursor: page.nextCursor ?? null,
        },
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function refreshCrew() {
    setError('');
    try {
      const [crewOut, playerPool] = await Promise.all([
        api.crew(token, city),
        api.listPlayers(token),
      ]);
      setCrew(crewOut);
      setPlayers(playerPool.filter((p) => p.id !== user.id));

      const regional = crewOut.regionalChannel?.key ?? '';
      const firstPublic = crewOut.publicChannels?.[0]?.key ?? 'france';
      const firstFriend = crewOut.friends?.[0]?.id ?? '';
      const firstClub = crewOut.clubChannels?.[0]?.key ?? '';

      setSelectedRegionalChannel(regional);
      setSelectedChannel((prev) => prev || firstPublic);
      setSelectedFriend((prev) => prev || firstFriend);
      setSelectedClubChannel((prev) => prev || firstClub);

      await Promise.all([
        refreshChannelMessages('france'),
        regional ? refreshChannelMessages(regional) : Promise.resolve(),
        firstPublic ? refreshChannelMessages(firstPublic) : Promise.resolve(),
        firstClub ? refreshChannelMessages(firstClub) : Promise.resolve(),
      ]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function refreshDmMessages(friendId, options = {}) {
    if (!friendId) {
      setDmMessages([]);
      setDmPaging({ hasMore: false, nextCursor: null, loading: false });
      return;
    }
    try {
      const page = await api.privateMessagesPage(token, friendId, {
        limit: options.limit ?? 30,
        before: options.before,
        markRead: options.markRead ? 1 : undefined,
      });
      setDmMessages((prev) => {
        if (options.append) {
          const seen = new Set(prev.map((item) => item.id));
          const merged = [...page.items, ...prev].filter((item) => {
            if (!item?.id) return true;
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          return merged;
        }
        return page.items ?? [];
      });
      setDmPaging((prev) => ({
        ...prev,
        hasMore: Boolean(page.hasMore),
        nextCursor: page.nextCursor ?? null,
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadMoreDm() {
    if (!selectedFriend || !dmPaging.hasMore || !dmPaging.nextCursor || dmPaging.loading) {
      return;
    }
    setDmPaging((prev) => ({ ...prev, loading: true }));
    await refreshDmMessages(selectedFriend, {
      append: true,
      before: dmPaging.nextCursor,
      limit: 30,
      markRead: false,
    });
    setDmPaging((prev) => ({ ...prev, loading: false }));
  }

  async function loadMoreChannel(channelKey) {
    const page = channelPaging[channelKey];
    if (!channelKey || !page?.hasMore || !page?.nextCursor) {
      return;
    }
    await refreshChannelMessages(channelKey, {
      append: true,
      before: page.nextCursor,
      limit: 40,
      markRead: false,
    });
  }

  useEffect(() => {
    detectCityFromLocation().catch(() => {});
  }, []);

  useEffect(() => {
    if (routeCity) {
      setCity(routeCity);
    }
  }, [routeCity]);

  useEffect(() => {
    refreshCrew().catch(() => {});
  }, [token, city]);

  useEffect(() => {
    if (!selectedFriend) {
      setDmMessages([]);
      return;
    }
    refreshDmMessages(selectedFriend, { markRead: true }).catch(() => {});
  }, [token, selectedFriend]);

  useEffect(() => {
    refreshChannelMessages(selectedChannel, { markRead: true }).catch(() => {});
  }, [selectedChannel]);

  useEffect(() => {
    refreshChannelMessages(selectedRegionalChannel, { markRead: activeTab === 'regional' }).catch(() => {});
  }, [selectedRegionalChannel, activeTab]);

  useEffect(() => {
    refreshChannelMessages(selectedClubChannel, { markRead: activeTab === 'clubs' }).catch(() => {});
  }, [selectedClubChannel, activeTab]);

  useEffect(() => {
    if (!routeFriendId) {
      return;
    }
    setSelectedFriend(routeFriendId);
    setActiveTab('home');
  }, [routeFriendId]);

  useEffect(() => {
    if (!token || !user?.id || !isFocused) {
      return undefined;
    }

    const tick = () => {
      refreshCrew().catch(() => {});
    };
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, [token, user?.id, isFocused, city]);

  useEffect(() => {
    if (!token || !user?.id || !isFocused) {
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
      return undefined;
    }

    if (streamRef.current) {
      streamRef.current();
    }

    streamRef.current = createCommunitySubscription({
      apiUrl: API_URL,
      token,
      onEvent: ({ event, data }) => {
        if (event === 'channel_message' && data?.message?.channel) {
          const key = data.message.channel;
          setChannelCache((prev) => {
            const current = prev[key] ?? [];
            if (current.some((item) => item.id === data.message.id)) {
              return prev;
            }
            return { ...prev, [key]: [...current, data.message] };
          });
        }

        if (event === 'dm_message' && data?.message) {
          const msg = data.message;
          const touchesSelected = selectedFriend
            && (msg.fromUserId === selectedFriend || msg.toUserId === selectedFriend);
          if (touchesSelected) {
            setDmMessages((prev) => {
              if (prev.some((item) => item.id === msg.id)) {
                return prev;
              }
              return [...prev, msg];
            });
          }
        }
      },
      onError: () => {},
      onFallbackPoll: () => {
        if (isFocused) {
          refreshCrew().catch(() => {});
        }
      },
    });

    return () => {
      if (streamRef.current) {
        streamRef.current();
        streamRef.current = null;
      }
    };
  }, [token, user?.id, isFocused, selectedFriend]);

  const friends = crew?.friends ?? [];
  const publicChannels = crew?.publicChannels ?? [];
  const clubChannels = crew?.clubChannels ?? [];
  const availableClubs = crew?.availableClubs ?? [];

  const friendSet = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);
  const suggestedPlayers = useMemo(() => players.filter((p) => !friendSet.has(p.id)).slice(0, 6), [players, friendSet]);

  const channelTitleByKey = useMemo(() => {
    const map = {};
    [...publicChannels, ...clubChannels].forEach((ch) => {
      map[ch.key] = ch.title;
    });
    if (crew?.regionalChannel?.key) {
      map[crew.regionalChannel.key] = crew.regionalChannel.title;
    }
    return map;
  }, [publicChannels, clubChannels, crew?.regionalChannel]);

  const homeFeed = useMemo(() => {
    const france = channelCache.france ?? [];
    const regional = selectedRegionalChannel ? (channelCache[selectedRegionalChannel] ?? []) : [];
    return [...france, ...regional]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 16)
      .map((item) => ({
        ...item,
        channelLabel: channelTitleByKey[item.channel] ?? t('community.channelFallback'),
      }));
  }, [channelCache, selectedRegionalChannel, channelTitleByKey, t]);

  const selectedChannelFeed = useMemo(() => {
    return (channelCache[selectedChannel] ?? []).slice(-24).reverse().map((item) => ({
      ...item,
      channelLabel: channelTitleByKey[item.channel] ?? t('community.channelFallback'),
    }));
  }, [channelCache, selectedChannel, channelTitleByKey, t]);

  const regionalFeed = useMemo(() => {
    return (channelCache[selectedRegionalChannel] ?? []).slice(-24).reverse().map((item) => ({
      ...item,
      channelLabel: channelTitleByKey[item.channel] ?? t('community.regionalFallback'),
    }));
  }, [channelCache, selectedRegionalChannel, channelTitleByKey, t]);

  const clubFeed = useMemo(() => {
    return (channelCache[selectedClubChannel] ?? []).slice(-24).reverse().map((item) => ({
      ...item,
      channelLabel: channelTitleByKey[item.channel] ?? t('community.clubFallback'),
    }));
  }, [channelCache, selectedClubChannel, channelTitleByKey, t]);

  async function sendChannelMessage(channelKey, text, clearFn) {
    if (!channelKey || !text.trim()) return;
    try {
      await api.sendChannelMessage(token, channelKey, text.trim());
      clearFn('');
      await refreshChannelMessages(channelKey);
      if (channelKey === selectedRegionalChannel || channelKey === 'france') {
        await Promise.all([
          refreshChannelMessages('france'),
          selectedRegionalChannel ? refreshChannelMessages(selectedRegionalChannel) : Promise.resolve(),
        ]);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendDM() {
    if (!selectedFriend || !dmInput.trim()) return;
    try {
      await api.sendPrivateMessage(token, selectedFriend, dmInput.trim());
      setDmInput('');
      await refreshDmMessages(selectedFriend, { markRead: true });
    } catch (e) {
      setError(e.message);
    }
  }

  async function addFriend(friendId) {
    try {
      await api.addFriend(token, friendId);
      await refreshCrew();
      setActiveTab('home');
    } catch (e) {
      setError(e.message);
    }
  }

  async function createChannel() {
    if (!newChannelName.trim()) return;
    try {
      const out = await api.createChannel(token, newChannelName.trim());
      setNewChannelName('');
      await refreshCrew();
      setSelectedChannel(out.key);
      setActiveTab('channels');
      await refreshChannelMessages(out.key);
    } catch (e) {
      setError(e.message);
    }
  }

  async function joinClub(codeValue = clubCode.trim()) {
    if (!codeValue.trim()) return false;
    try {
      const out = await api.joinClubByCode(token, codeValue.trim());
      setClubCode('');
      await refreshCrew();
      setSelectedClubChannel(out.channel.key);
      setActiveTab('clubs');
      await refreshChannelMessages(out.channel.key);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  async function onScanClubQr(rawValue) {
    const code = clubCodeFromQrValue(rawValue);
    if (!code) {
      setError(t('community.invalidClubQr'));
      return false;
    }
    const ok = await joinClub(code);
    if (ok) {
      setClubQrOpen(false);
    }
    return ok;
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshCrew();
      if (selectedFriend) {
        await refreshDmMessages(selectedFriend, { markRead: true });
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent2} />}
    >
      <LinearGradient colors={['#163448', '#0C2333', '#081823']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroTitle}>{t('community.title')}</Text>
        <Text style={styles.heroGreeting}>{greeting}</Text>
        <Text style={styles.heroPitch}>{t('community.pitch')}</Text>

        <View style={styles.heroMetaRow}>
          <Pressable style={styles.cityChip} onPress={() => setCityPickerOpen((v) => !v)}>
            <Text style={styles.cityChipText}>{isLocating ? t('community.locating') : `📍 ${city}`}</Text>
          </Pressable>
          <Pressable style={styles.cityRefreshChip} onPress={detectCityFromLocation}>
            <Text style={styles.cityRefreshChipText}>{t('community.auto')}</Text>
          </Pressable>
        </View>

        {cityPickerOpen ? (
          <View style={styles.cityPicker}>
            {CITY_PRESETS.map((value) => (
              <Pressable
                key={value}
                style={[styles.cityPreset, value.toLowerCase() === city.toLowerCase() && styles.cityPresetActive]}
                onPress={() => {
                  setCity(value);
                  setCityPickerOpen(false);
                }}
              >
                <Text style={[styles.cityPresetText, value.toLowerCase() === city.toLowerCase() && styles.cityPresetTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.topTabs}>
        {TOP_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.topTab, activeTab === tab.key && styles.topTabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.topTabText, activeTab === tab.key && styles.topTabTextActive]}>{t(tab.i18n)}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeTab === 'home' ? (
        <>
          <Card>
            <Text style={styles.sectionTitle}>{t('community.friendsMessages')}</Text>
            <View style={styles.friendsWrap}>
              {friends.map((friend) => (
                <Pressable
                  key={friend.id}
                  style={[styles.friendChip, selectedFriend === friend.id && styles.friendChipActive]}
                  onPress={() => setSelectedFriend(friend.id)}
                >
                  <Avatar name={friend.displayName} active={selectedFriend === friend.id} />
                  <Text style={[styles.friendChipText, selectedFriend === friend.id && styles.friendChipTextActive]}>{friend.displayName}</Text>
                </Pressable>
              ))}
            </View>

            {selectedFriend ? (
              <>
                <View style={styles.dmBox}>
                  {dmPaging.hasMore ? (
                    <Pressable style={styles.loadMoreBtn} onPress={loadMoreDm}>
                      <Text style={styles.loadMoreBtnText}>{t('community.loadMore')}</Text>
                    </Pressable>
                  ) : null}
                  {dmMessages.slice(-10).map((item, index) => (
                    <DmBubble
                      key={messageKey(item, index, 'dm')}
                      mine={item.fromUserId === user.id}
                      text={item.text}
                      createdAt={item.createdAt}
                    />
                  ))}
                  {dmMessages.length === 0 ? <Text style={styles.emptyText}>{t('community.startPrivateChat')}</Text> : null}
                </View>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.rowInput]}
                    value={dmInput}
                    onChangeText={setDmInput}
                    placeholder={t('community.writePartner')}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <Pressable style={styles.actionBtn} onPress={sendDM}>
                    <Text style={styles.actionBtnText}>{t('community.send')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>{t('community.noFriends')}</Text>
            )}
          </Card>

          {suggestedPlayers.length > 0 ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('community.newPartners')}</Text>
              {suggestedPlayers.map((p) => (
                <View key={p.id} style={styles.suggestRow}>
                  <View style={styles.suggestLeft}>
                    <Avatar name={p.displayName} />
                    <View>
                      <Text style={styles.suggestName}>{p.displayName}</Text>
                      <Text style={styles.suggestMeta}>{p.city ?? t('community.unknownCity')} · PIR {Math.round(p.rating)}</Text>
                    </View>
                  </View>
                  <Pressable style={styles.addBtn} onPress={() => addFriend(p.id)}>
                    <Text style={styles.addBtnText}>{t('community.add')}</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Text style={styles.sectionTitle}>{t('community.news')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={homeInput}
              onChangeText={setHomeInput}
              placeholder={t('community.sharePlaceholder')}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <View style={styles.row}>
              <Pressable style={styles.actionBtn} onPress={() => sendChannelMessage('france', homeInput, setHomeInput)}>
                <Text style={styles.actionBtnText}>{t('community.postFrance')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => sendChannelMessage(selectedRegionalChannel, homeInput, setHomeInput)}>
                <Text style={styles.secondaryBtnText}>{t('community.postRegional')}</Text>
              </Pressable>
            </View>
              <View style={styles.feedList}>
                {homeFeed.map((item, index) => (
                  <PostCard key={messageKey(item, index, 'home')} item={item} mine={item.senderId === user.id} t={t} />
                ))}
                {homeFeed.length === 0 ? <Text style={styles.emptyText}>{t('community.noNews')}</Text> : null}
              </View>
          </Card>
        </>
      ) : null}

      {activeTab === 'regional' ? (
        <>
          <LinearGradient colors={['#2C6958', '#1E4E44']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <Text style={styles.bannerTitle}>{t('community.regionalBanner', { city })}</Text>
            <Text style={styles.bannerSub}>{t('community.regionalPitch')}</Text>
          </LinearGradient>

          <Card>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={regionalInput}
              onChangeText={setRegionalInput}
              placeholder={t('community.publishInCity', { city })}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <Pressable style={styles.actionBtn} onPress={() => sendChannelMessage(selectedRegionalChannel, regionalInput, setRegionalInput)}>
              <Text style={styles.actionBtnText}>{t('community.publish')}</Text>
            </Pressable>
          </Card>

          <View style={styles.feedList}>
            {channelPaging[selectedRegionalChannel]?.hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => loadMoreChannel(selectedRegionalChannel)}>
                <Text style={styles.loadMoreBtnText}>{t('community.loadMore')}</Text>
              </Pressable>
            ) : null}
            {regionalFeed.map((item, index) => (
              <PostCard key={messageKey(item, index, 'regional')} item={item} mine={item.senderId === user.id} t={t} />
            ))}
            {regionalFeed.length === 0 ? <Text style={styles.emptyText}>{t('community.regionalEmpty')}</Text> : null}
          </View>
        </>
      ) : null}

      {activeTab === 'channels' ? (
        <>
          <LinearGradient colors={['#2A3E71', '#1B2F59']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <Text style={styles.bannerTitle}>{t('community.channelsTitle')}</Text>
            <Text style={styles.bannerSub}>{t('community.channelsPitch')}</Text>
          </LinearGradient>

          <Card>
            <Text style={styles.sectionTitle}>{t('community.chooseChannel')}</Text>
            <View style={styles.pillsWrap}>
              {publicChannels.map((ch) => (
                <ChannelPill key={ch.key} label={ch.title} active={selectedChannel === ch.key} onPress={() => setSelectedChannel(ch.key)} />
              ))}
            </View>

            <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.rowInput]}
                  value={newChannelName}
                  onChangeText={setNewChannelName}
                  placeholder={t('community.newChannelPlaceholder')}
                  placeholderTextColor={theme.colors.muted}
                />
                <Pressable style={styles.secondaryBtn} onPress={createChannel}>
                  <Text style={styles.secondaryBtnText}>{t('community.create')}</Text>
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, styles.multiline]}
                value={channelInput}
                onChangeText={setChannelInput}
                placeholder={t('community.channelMessagePlaceholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
              />
              <Pressable style={styles.actionBtn} onPress={() => sendChannelMessage(selectedChannel, channelInput, setChannelInput)}>
                <Text style={styles.actionBtnText}>{t('community.publish')}</Text>
              </Pressable>
            </Card>

            <View style={styles.feedList}>
              {channelPaging[selectedChannel]?.hasMore ? (
                <Pressable style={styles.loadMoreBtn} onPress={() => loadMoreChannel(selectedChannel)}>
                  <Text style={styles.loadMoreBtnText}>{t('community.loadMore')}</Text>
                </Pressable>
              ) : null}
              {selectedChannelFeed.map((item, index) => (
                <PostCard key={messageKey(item, index, 'channel')} item={item} mine={item.senderId === user.id} t={t} />
              ))}
              {selectedChannelFeed.length === 0 ? <Text style={styles.emptyText}>{t('community.channelEmpty')}</Text> : null}
            </View>
          </>
        ) : null}

      {activeTab === 'clubs' ? (
        <>
          <LinearGradient colors={['#6D3D28', '#492B1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
            <Text style={styles.bannerTitle}>{t('community.clubsTitle')}</Text>
            <Text style={styles.bannerSub}>{t('community.clubsPitch')}</Text>
          </LinearGradient>

          <Card>
            <Text style={styles.sectionTitle}>{t('community.joinClub')}</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.rowInput]}
                value={clubCode}
                onChangeText={setClubCode}
                placeholder={t('community.clubCode')}
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="characters"
              />
              <Pressable style={styles.secondaryBtn} onPress={() => setClubQrOpen(true)}>
                <Text style={styles.secondaryBtnText}>{t('community.scanClubQr')}</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={joinClub}>
                <Text style={styles.actionBtnText}>{t('community.join')}</Text>
              </Pressable>
            </View>

            {availableClubs.length > 0 ? (
              <View style={styles.clubList}>
                {availableClubs.map((club) => (
                  <View key={club.key} style={styles.clubRow}>
                    <View>
                      <Text style={styles.clubName}>{club.title}</Text>
                      <Text style={styles.clubMeta}>{club.city}</Text>
                    </View>
                    <Text style={styles.clubState}>{club.joined ? t('community.clubJoined') : t('community.clubAvailable')}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>{t('community.noClubForCity')}</Text>
            )}
          </Card>

          {clubChannels.length > 0 ? (
            <Card>
              <Text style={styles.sectionTitle}>{t('community.myClubs')}</Text>
              <View style={styles.pillsWrap}>
                {clubChannels.map((ch) => (
                  <ChannelPill key={ch.key} label={ch.title} active={selectedClubChannel === ch.key} onPress={() => setSelectedClubChannel(ch.key)} />
                ))}
              </View>

              <TextInput
                style={[styles.input, styles.multiline]}
                value={clubInput}
                onChangeText={setClubInput}
                placeholder={t('community.clubMessagePlaceholder')}
                placeholderTextColor={theme.colors.muted}
                multiline
              />
              <Pressable style={styles.actionBtn} onPress={() => sendChannelMessage(selectedClubChannel, clubInput, setClubInput)}>
                <Text style={styles.actionBtnText}>{t('community.publish')}</Text>
              </Pressable>
            </Card>
          ) : null}

          <View style={styles.feedList}>
            {channelPaging[selectedClubChannel]?.hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => loadMoreChannel(selectedClubChannel)}>
                <Text style={styles.loadMoreBtnText}>{t('community.loadMore')}</Text>
              </Pressable>
            ) : null}
            {clubFeed.map((item, index) => (
              <PostCard key={messageKey(item, index, 'club')} item={item} mine={item.senderId === user.id} t={t} />
            ))}
            {clubFeed.length === 0 ? <Text style={styles.emptyText}>{t('community.clubFeedEmpty')}</Text> : null}
          </View>

          <Card>
            <Text style={styles.sectionTitle}>{t('community.localRanking', { city })}</Text>
            {(crew?.leaderboard ?? []).slice(0, 8).map((row) => (
              <View key={row.userId} style={styles.rankRow}>
                <Text style={styles.rankName}>#{row.rank} {row.displayName}</Text>
                <Text style={styles.rankScore}>{row.rating}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <QrScannerModal
        visible={clubQrOpen}
        title={t('community.scanClubQr')}
        subtitle={t('community.scanClubQrSub')}
        onScan={onScanClubQr}
        onClose={() => setClubQrOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 26,
    gap: 12,
  },
  hero: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(157, 185, 203, 0.35)',
    gap: 8,
  },
  heroTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.display,
    fontSize: 36,
    lineHeight: 38,
  },
  heroGreeting: {
    color: '#D9EEF9',
    fontFamily: theme.fonts.title,
    fontSize: 15,
  },
  heroPitch: {
    color: '#A8C4D6',
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 19, 30, 0.72)',
    borderWidth: 1,
    borderColor: '#3A6079',
  },
  cityChipText: {
    color: '#E8F3FA',
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cityRefreshChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A6079',
    backgroundColor: 'rgba(8, 19, 30, 0.55)',
  },
  cityRefreshChipText: {
    color: '#D3E9F7',
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  cityPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityPreset: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F6581',
    backgroundColor: 'rgba(12, 36, 51, 0.8)',
  },
  cityPresetActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  cityPresetText: {
    color: '#D7EAF6',
    fontFamily: theme.fonts.title,
    fontSize: 11,
  },
  cityPresetTextActive: {
    color: '#3A2500',
  },
  topTabs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  topTab: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.chip,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTabActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  topTabText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  topTabTextActive: {
    color: '#3A2500',
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 185, 203, 0.25)',
    padding: 12,
    gap: 4,
  },
  bannerTitle: {
    color: '#F1F6FA',
    fontFamily: theme.fonts.title,
    fontSize: 16,
  },
  bannerSub: {
    color: '#C9DDEA',
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 16,
    marginBottom: 8,
  },
  friendsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#123349',
  },
  friendChipActive: {
    borderColor: '#6A96AE',
    backgroundColor: '#235068',
  },
  friendChipText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 12,
  },
  friendChipTextActive: {
    color: '#E8F4FB',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#4F7C97',
    backgroundColor: '#1B4861',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  avatarText: {
    color: '#E0F0FA',
    fontFamily: theme.fonts.title,
    fontSize: 10,
  },
  avatarTextActive: {
    color: '#3A2500',
  },
  dmBox: {
    borderWidth: 1,
    borderColor: 'rgba(157, 185, 203, 0.28)',
    borderRadius: 12,
    minHeight: 120,
    backgroundColor: 'rgba(7, 23, 34, 0.7)',
    padding: 10,
    gap: 8,
  },
  loadMoreBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${theme.colors.accent2}33`,
    borderWidth: 1,
    borderColor: `${theme.colors.accent2}66`,
  },
  loadMoreBtnText: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.title,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dmBubble: {
    maxWidth: '88%',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 4,
  },
  dmBubbleMine: {
    backgroundColor: '#2A7A66',
    alignSelf: 'flex-end',
  },
  dmBubbleOther: {
    backgroundColor: '#1E455C',
    alignSelf: 'flex-start',
  },
  dmBubbleText: {
    color: '#EAF6FD',
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  dmTime: {
    color: '#C6DCEA',
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
    color: theme.colors.text,
    paddingHorizontal: 12,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  rowInput: {
    flex: 1,
    minHeight: 44,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  actionBtn: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  actionBtnText: {
    color: '#3A2500',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    minHeight: 44,
    minWidth: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bgAlt,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.18)',
    paddingVertical: 8,
    gap: 8,
  },
  suggestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  suggestName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 14,
  },
  suggestMeta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  addBtn: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: '#2E6F5E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  addBtnText: {
    color: '#ECFFF9',
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  feedList: {
    gap: 8,
  },
  postCard: {
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  postHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postAuthorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthor: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
  postMeta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  postText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  channelPill: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: '#13344A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  channelPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  channelPillText: {
    color: '#D8EBF8',
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  channelPillTextActive: {
    color: '#3A2500',
  },
  clubList: {
    marginTop: 8,
    gap: 6,
  },
  clubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.18)',
  },
  clubName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
  clubMeta: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  clubState: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(157, 185, 203, 0.17)',
    paddingVertical: 7,
  },
  rankName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
  rankScore: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono,
    fontSize: 12,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
});
