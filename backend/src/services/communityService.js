import { store } from '../store/index.js';
import { findBalancedMatches } from '../engine/matchmaking.js';

const FALLBACK_CLUB_CHANNELS = [
  {
    key: 'club:urban-padel-lyon',
    title: 'Urban Padel Lyon',
    city: 'Lyon',
    joinCode: 'UP-LYON-01',
  },
  {
    key: 'club:esprit-padel-villeurbanne',
    title: 'Esprit Padel Villeurbanne',
    city: 'Lyon',
    joinCode: 'EP-VILLEUR-02',
  },
  {
    key: 'club:casa-padel-paris',
    title: 'Casa Padel Paris',
    city: 'Paris',
    joinCode: 'CP-PARIS-01',
  },
];

const communitySubscribers = new Map();
let lastMessageTs = 0;

function normalize(text) {
  return String(text ?? '').trim();
}

function normalizedLower(text) {
  return normalize(text).toLowerCase();
}

function isRegionalChannel(key) {
  return String(key).startsWith('city:');
}

function isClubChannel(key) {
  return String(key).startsWith('club:');
}

function isCustomChannel(key) {
  return String(key).startsWith('custom:');
}

function haversine(a, b) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const q = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(q));
}

function cityChannelKey(city) {
  return `city:${normalizedLower(city)}`;
}

function safeProfile(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    arcadeTag: user.arcadeTag ?? makeArcadeTag(user),
    rating: user.rating,
    pir: user.pir,
    city: user.city,
  };
}

function makeArcadeTag(user) {
  const base = normalizedLower(user.displayName ?? 'player')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 7)
    .toUpperCase()
    || 'PLAYER';
  const suffix = String(user.id ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  return `${base}#${suffix}`;
}

function normalizeArcadeTag(tag) {
  return normalizedLower(tag).replace(/\s+/g, '').replace('-', '');
}

function stablePairKey(userA, userB) {
  return [String(userA ?? ''), String(userB ?? '')].sort().join(':');
}

function nextMessageIso() {
  const now = Date.now();
  if (now <= lastMessageTs) {
    lastMessageTs += 1;
  } else {
    lastMessageTs = now;
  }
  return new Date(lastMessageTs).toISOString();
}

function parseTimeMs(value) {
  const ms = new Date(value ?? '').getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function clampLimit(value, fallback, max) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function makeReadMarkers(raw = {}) {
  return {
    channels: raw.channels && typeof raw.channels === 'object' ? raw.channels : {},
    dms: raw.dms && typeof raw.dms === 'object' ? raw.dms : {},
  };
}

async function getClubs() {
  if (typeof store.listClubs === 'function') {
    const clubs = await store.listClubs();
    if (clubs.length > 0) {
      return clubs;
    }
  }
  return FALLBACK_CLUB_CHANNELS;
}

async function ensureChannelSeed(channel, label) {
  if (typeof store.listChannelMessages !== 'function' || typeof store.addChannelMessage !== 'function') {
    return;
  }

  const current = await store.listChannelMessages(channel, 1);
  if (current.length > 0) {
    return;
  }

  await store.addChannelMessage({
    id: `msg_${Date.now()}`,
    channel,
    text: `Bienvenue dans le canal ${label}.`,
    senderName: 'Padely Bot',
    senderId: 'system',
    createdAt: new Date().toISOString(),
  });
}

async function channelTitleFromKey(channel) {
  if (channel === 'france') return 'Canal France';
  if (isRegionalChannel(channel)) {
    const city = channel.split(':')[1] ?? 'region';
    return `Canal ${city.charAt(0).toUpperCase()}${city.slice(1)}`;
  }
  if (isClubChannel(channel)) {
    const clubs = await getClubs();
    const club = clubs.find((c) => c.key === channel);
    return club?.title ?? 'Canal club';
  }
  if (isCustomChannel(channel)) {
    const name = channel.split(':')[1] ?? 'canal';
    return `Canal ${name.replaceAll('-', ' ')}`;
  }
  return 'Canal';
}

function getCommunityState(user) {
  const state = user.community ?? {
    customChannels: [],
    joinedClubChannels: [],
  };
  return {
    customChannels: Array.isArray(state.customChannels) ? state.customChannels : [],
    joinedClubChannels: Array.isArray(state.joinedClubChannels) ? state.joinedClubChannels : [],
    readMarkers: makeReadMarkers(state.readMarkers),
  };
}

async function writeCommunityState(userId, nextState) {
  await store.updateUser(userId, {
    community: {
      customChannels: nextState.customChannels,
      joinedClubChannels: nextState.joinedClubChannels,
      readMarkers: makeReadMarkers(nextState.readMarkers),
    },
  });
}

function makeCustomChannelKey(name) {
  const slug = normalizedLower(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `custom:${slug || 'general'}`;
}

async function isAllowedChannelForUser(user, channel) {
  if (channel === 'france' || isRegionalChannel(channel)) {
    return true;
  }

  const community = getCommunityState(user);
  if (isCustomChannel(channel)) {
    return community.customChannels.includes(channel);
  }

  if (isClubChannel(channel)) {
    return community.joinedClubChannels.includes(channel);
  }

  return false;
}

async function getClubByCode(code) {
  const safe = normalizedLower(code);
  if (typeof store.getClubByJoinCode === 'function') {
    const club = await store.getClubByJoinCode(safe);
    if (club) {
      return club;
    }
  }
  const clubs = await getClubs();
  return clubs.find((club) => normalizedLower(club.joinCode) === safe) ?? null;
}

export async function searchPlayers({ ratingMin = 0, ratingMax = 9999, lat, lng, radiusKm = 25 }) {
  const all = await store.listUsers();
  return all.filter((user) => {
    if (user.rating < ratingMin || user.rating > ratingMax) {
      return false;
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return true;
    }

    if (!user.location) {
      return false;
    }

    const d = haversine({ lat, lng }, user.location);
    return d <= radiusKm;
  }).map((user) => ({
    id: user.id,
    displayName: user.displayName,
    arcadeTag: user.arcadeTag ?? makeArcadeTag(user),
    rating: user.rating,
    city: user.city,
    location: user.location,
  }));
}

export async function getBalancedProposals(players, maxResults) {
  return findBalancedMatches(players, { maxResults });
}

export async function refreshCityLeaderboard(city) {
  const users = (await store.listUsers())
    .filter((u) => (u.city ?? '').toLowerCase() === city.toLowerCase())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)
    .map((u, index) => ({
      rank: index + 1,
      userId: u.id,
      displayName: u.displayName,
      rating: u.rating,
      pir: u.pir,
    }));

  await store.setLeaderboard(city, users);
  return users;
}

export async function getCityLeaderboard(city) {
  const current = await store.getLeaderboard(city);
  if (current.length > 0) {
    return current;
  }

  return refreshCityLeaderboard(city);
}

function periodRange(period) {
  const now = new Date();
  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, label: 'jour' };
  }
  if (period === 'week') {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return { start, label: 'semaine' };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, label: 'mois' };
  }
  return { start: new Date(0), label: 'global' };
}

function rankRewards(period) {
  if (period === 'day') {
    return [
      { rank: 1, reward: '1 boisson + badge Daily King' },
      { rank: 2, reward: 'Badge Daily Top 2' },
      { rank: 3, reward: 'Badge Daily Top 3' },
    ];
  }
  if (period === 'week') {
    return [
      { rank: 1, reward: 'Bon partenaire 20 EUR' },
      { rank: 2, reward: 'Bon partenaire 10 EUR' },
      { rank: 3, reward: 'Badge Weekly Podium' },
    ];
  }
  if (period === 'month') {
    return [
      { rank: 1, reward: 'Pack premium 1 mois + trophée city' },
      { rank: 2, reward: 'Pack premium 2 semaines' },
      { rank: 3, reward: 'Badge Monthly Podium' },
    ];
  }
  return [
    { rank: 1, reward: 'Hall of fame Padely' },
  ];
}

export async function getTemporalLeaderboard({ city, period = 'all', limit = 20 }) {
  const users = await store.listUsers();
  const { start, label } = periodRange(period);
  const scoped = users.filter((u) => !city || normalizedLower(u.city ?? '') === normalizedLower(city));

  const rows = scoped.map((u) => {
    const recent = (u.history ?? []).filter((h) => new Date(h.at).getTime() >= start.getTime());
    const points = recent.reduce((sum, h) => sum + Number(h.delta ?? 0), 0);
    const wins = recent.filter((h) => Number(h.delta ?? 0) > 0).length;
    const losses = recent.length - wins;
    const form = Math.round(recent.slice(-5).reduce((s, h) => s + Number(h.delta ?? 0), 0));
    // Ranking score mixes true rating + recent performance.
    const rankingScore = Number((u.rating + points * 10 + wins * 12 - losses * 4).toFixed(2));
    return {
      userId: u.id,
      displayName: u.displayName,
      arcadeTag: u.arcadeTag ?? makeArcadeTag(u),
      city: u.city,
      rating: Number(u.rating.toFixed(2)),
      pir: Number((u.pir ?? 0).toFixed(2)),
      periodPoints: Number(points.toFixed(2)),
      wins,
      losses,
      form,
      rankingScore,
    };
  }).sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, Math.max(5, Math.min(100, limit)))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    city: city ?? 'all',
    period,
    periodLabel: label,
    generatedAt: new Date().toISOString(),
    rewards: rankRewards(period),
    rows,
  };
}

export async function findPlayerByArcadeTag(tag) {
  const normalized = normalizeArcadeTag(tag);
  if (!normalized) {
    throw new Error('Arcade tag requis');
  }
  const users = await store.listUsers();
  const match = users.find((u) => normalizeArcadeTag(u.arcadeTag ?? makeArcadeTag(u)) === normalized);
  if (!match) {
    throw new Error('Aucun joueur pour ce tag');
  }
  return safeProfile(match);
}

export async function connectByArcadeTag(userId, arcadeTag) {
  const target = await findPlayerByArcadeTag(arcadeTag);
  if (target.id === userId) {
    throw new Error('Tag personnel non valide pour ajout');
  }
  return addFriend(userId, target.id);
}

export async function createCustomChannel(userId, channelName) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const name = normalize(channelName);
  if (name.length < 3) {
    throw new Error('Nom de canal trop court');
  }

  const channelKey = makeCustomChannelKey(name);
  const community = getCommunityState(user);
  if (!community.customChannels.includes(channelKey)) {
    const next = [...community.customChannels, channelKey];
    await store.updateUser(user.id, {
      community: {
        ...community,
        customChannels: next,
      },
    });
  }

  await ensureChannelSeed(channelKey, name);

  return {
    key: channelKey,
    title: `Canal ${name}`,
    type: 'custom',
  };
}

export async function joinClubByCode(userId, code) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const club = await getClubByCode(code);
  if (!club) {
    throw new Error('Code club invalide');
  }

  const community = getCommunityState(user);
  if (!community.joinedClubChannels.includes(club.key)) {
    const next = [...community.joinedClubChannels, club.key];
    await store.updateUser(user.id, {
      community: {
        ...community,
        joinedClubChannels: next,
      },
    });
  }

  await ensureChannelSeed(club.key, club.title);

  return {
    joined: true,
    channel: {
      key: club.key,
      title: club.title,
      type: 'club',
      city: club.city,
    },
  };
}

export async function getCrewOverview(userId, cityOverride) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.arcadeTag) {
    await store.updateUser(user.id, { arcadeTag: makeArcadeTag(user) });
  }

  const city = normalize(cityOverride ?? user.city ?? 'Lyon') || 'Lyon';
  const regionKey = cityChannelKey(city);
  await ensureChannelSeed('france', 'France');
  await ensureChannelSeed(regionKey, city);

  const leaderboard = await getCityLeaderboard(city);
  const friendIds = user.friends ?? [];
  const friendUsers = await Promise.all(friendIds.map((id) => store.getUserById(id)));

  const community = getCommunityState(user);
  const customChannels = await Promise.all(community.customChannels.map(async (key) => ({
    key,
    title: await channelTitleFromKey(key),
    type: 'custom',
  })));
  const publicChannels = [
    {
      key: 'france',
      title: 'Canal France',
      type: 'global',
    },
    {
      key: regionKey,
      title: `Canal ${city}`,
      type: 'regional',
      city,
    },
    ...customChannels,
  ];

  const clubs = await getClubs();
  const clubChannels = community.joinedClubChannels.map((key) => {
    const club = clubs.find((item) => item.key === key);
    return {
      key,
      title: club?.title ?? key,
      type: 'club',
      city: club?.city ?? city,
      joined: true,
    };
  });

  const availableClubs = clubs.filter((club) =>
    normalizedLower(club.city) === normalizedLower(city)
  ).map((club) => ({
    key: club.key,
    title: club.title,
    city: club.city,
    joined: community.joinedClubChannels.includes(club.key),
  }));

  const unread = await getUnreadSummary(user.id);

  return {
    city,
    arcadeTag: user.arcadeTag ?? makeArcadeTag(user),
    regionalChannel: {
      key: regionKey,
      title: `Canal ${city}`,
      city,
    },
    publicChannels,
    clubChannels,
    availableClubs,
    channels: [...publicChannels, ...clubChannels],
    friends: friendUsers.filter(Boolean).map(safeProfile),
    leaderboard,
    unread,
  };
}

async function fetchChannelMessagesRaw(channel, limit = 80) {
  if (typeof store.listChannelMessages === 'function') {
    return store.listChannelMessages(channel, limit);
  }
  return [];
}

async function fetchPrivateMessagesRaw(userId, friendId, limit = 80) {
  if (typeof store.listPrivateMessages === 'function') {
    return store.listPrivateMessages(userId, friendId, limit);
  }
  return [];
}

async function listAllowedChannelsForUser(user) {
  const community = getCommunityState(user);
  const city = normalize(user.city ?? 'Lyon') || 'Lyon';
  const channels = new Set([
    'france',
    cityChannelKey(city),
    ...community.customChannels,
    ...community.joinedClubChannels,
  ]);
  return [...channels];
}

async function emitEventToUser(userId, event, payload = {}) {
  const listeners = communitySubscribers.get(userId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const unread = await getUnreadSummary(userId);
  for (const callback of listeners) {
    try {
      callback({
        event,
        data: {
          ...payload,
          unread,
          emittedAt: new Date().toISOString(),
        },
      });
    } catch {
      // Ignore per-listener failures.
    }
  }
}

async function emitEventToUsers(userIds, event, payload = {}) {
  const unique = [...new Set((userIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))];
  await Promise.all(unique.map((userId) => emitEventToUser(userId, event, payload)));
}

export async function listChannelMessagesForUser(userId, channel, options = {}) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const safeChannel = String(channel ?? '').trim();
  if (!await isAllowedChannelForUser(user, safeChannel)) {
    throw new Error('Canal non autorise');
  }

  const limit = clampLimit(options.limit, 40, 80);
  const beforeMs = parseTimeMs(options.before);
  const raw = await fetchChannelMessagesRaw(safeChannel, Math.min(220, limit * 4));
  const filtered = raw.filter((item) => {
    if (!beforeMs) {
      return true;
    }
    return parseTimeMs(item.createdAt) < beforeMs;
  });
  const hasMore = filtered.length > limit;
  const items = filtered.slice(Math.max(0, filtered.length - limit));
  const nextCursor = hasMore && items.length > 0 ? items[0].createdAt : null;
  if (options.markRead && items.length > 0) {
    await markChannelRead(userId, safeChannel, new Date().toISOString());
  }
  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function listChannelMessages(channel, limit = 40) {
  const out = await fetchChannelMessagesRaw(channel, limit);
  return out;
}

export async function postChannelMessage({ userId, channel, text }) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!text || text.trim().length < 1) {
    throw new Error('Message vide');
  }

  if (!await isAllowedChannelForUser(user, channel)) {
    throw new Error('Canal non autorise');
  }

  await ensureChannelSeed(channel, await channelTitleFromKey(channel));

  const item = {
    id: `msg_${Date.now()}_${Math.round(Math.random() * 9999)}`,
    channel,
    text: text.trim(),
    senderName: user.displayName,
    senderId: user.id,
    createdAt: nextMessageIso(),
  };

  if (typeof store.addChannelMessage === 'function') {
    await store.addChannelMessage(item);
  }

  const users = await store.listUsers();
  const recipients = [];
  for (const candidate of users) {
    if (await isAllowedChannelForUser(candidate, channel)) {
      recipients.push(candidate.id);
    }
  }

  await emitEventToUsers(recipients, 'channel_message', {
    channel,
    message: item,
  });
  return item;
}

export async function addFriend(userId, friendId) {
  if (!friendId || friendId === userId) {
    throw new Error('friendId invalide');
  }
  const user = await store.getUserById(userId);
  const friend = await store.getUserById(friendId);
  if (!user || !friend) {
    throw new Error('Utilisateur introuvable');
  }

  const uFriends = new Set(user.friends ?? []);
  const fFriends = new Set(friend.friends ?? []);
  uFriends.add(friendId);
  fFriends.add(userId);

  await store.updateUser(userId, { friends: [...uFriends] });
  await store.updateUser(friendId, { friends: [...fFriends] });

  return {
    ok: true,
    friend: safeProfile(friend),
  };
}

export async function listPrivateMessages(userId, friendId, limit = 60) {
  const out = await fetchPrivateMessagesRaw(userId, friendId, limit);
  return out;
}

export async function listPrivateMessagesForUser(userId, friendId, options = {}) {
  const user = await store.getUserById(userId);
  const friend = await store.getUserById(friendId);
  if (!user || !friend) {
    throw new Error('Utilisateur introuvable');
  }

  const limit = clampLimit(options.limit, 60, 100);
  const beforeMs = parseTimeMs(options.before);
  const raw = await fetchPrivateMessagesRaw(userId, friendId, Math.min(260, limit * 4));
  const filtered = raw.filter((item) => {
    if (!beforeMs) {
      return true;
    }
    return parseTimeMs(item.createdAt) < beforeMs;
  });
  const hasMore = filtered.length > limit;
  const items = filtered.slice(Math.max(0, filtered.length - limit));
  const nextCursor = hasMore && items.length > 0 ? items[0].createdAt : null;
  if (options.markRead && items.length > 0) {
    await markPrivateRead(userId, friendId, new Date().toISOString());
  }
  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function postPrivateMessage({ fromUserId, toUserId, text }) {
  if (!text || text.trim().length < 1) {
    throw new Error('Message vide');
  }

  const from = await store.getUserById(fromUserId);
  const to = await store.getUserById(toUserId);
  if (!from || !to) {
    throw new Error('Utilisateur introuvable');
  }

  const message = {
    id: `dm_${Date.now()}_${Math.round(Math.random() * 9999)}`,
    fromUserId,
    toUserId,
    text: text.trim(),
    createdAt: nextMessageIso(),
  };
  if (typeof store.addPrivateMessage === 'function') {
    await store.addPrivateMessage(message);
  }

  await emitEventToUsers([fromUserId, toUserId], 'dm_message', {
    participants: [fromUserId, toUserId],
    message,
  });
  return message;
}

export async function markChannelRead(userId, channel, readAt = new Date().toISOString()) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!await isAllowedChannelForUser(user, channel)) {
    throw new Error('Canal non autorise');
  }

  const community = getCommunityState(user);
  const markers = makeReadMarkers(community.readMarkers);
  markers.channels[channel] = readAt;
  await writeCommunityState(user.id, {
    ...community,
    readMarkers: markers,
  });

  await emitEventToUser(user.id, 'unread_update', {
    scope: 'channel',
    channel,
    readAt,
  });
  return { ok: true, channel, readAt };
}

export async function markPrivateRead(userId, friendId, readAt = new Date().toISOString()) {
  const user = await store.getUserById(userId);
  const friend = await store.getUserById(friendId);
  if (!user || !friend) {
    throw new Error('Utilisateur introuvable');
  }

  const community = getCommunityState(user);
  const markers = makeReadMarkers(community.readMarkers);
  const dmKey = stablePairKey(userId, friendId);
  markers.dms[dmKey] = readAt;
  await writeCommunityState(user.id, {
    ...community,
    readMarkers: markers,
  });

  await emitEventToUser(user.id, 'unread_update', {
    scope: 'dm',
    friendId,
    readAt,
  });
  return { ok: true, friendId, readAt };
}

export async function getUnreadSummary(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const community = getCommunityState(user);
  const markers = makeReadMarkers(community.readMarkers);
  const channels = await listAllowedChannelsForUser(user);
  const channelUnread = {};
  let channelTotal = 0;

  for (const channel of channels) {
    const readAtMs = parseTimeMs(markers.channels[channel]);
    const messages = await fetchChannelMessagesRaw(channel, 120);
    const count = messages.filter((item) =>
      item.senderId !== user.id
      && parseTimeMs(item.createdAt) > readAtMs
    ).length;
    channelUnread[channel] = count;
    channelTotal += count;
  }

  const friends = user.friends ?? [];
  const dmUnread = {};
  let dmTotal = 0;

  for (const friendId of friends) {
    const dmKey = stablePairKey(user.id, friendId);
    const readAtMs = parseTimeMs(markers.dms[dmKey]);
    const messages = await fetchPrivateMessagesRaw(user.id, friendId, 120);
    const count = messages.filter((item) =>
      item.toUserId === user.id
      && parseTimeMs(item.createdAt) > readAtMs
    ).length;
    dmUnread[friendId] = count;
    dmTotal += count;
  }

  return {
    totalUnread: channelTotal + dmTotal,
    channels: channelUnread,
    dms: dmUnread,
  };
}

export function subscribeCommunityFeed({ userId, onEvent }) {
  const actor = String(userId ?? '').trim();
  if (!actor) {
    throw new Error('userId requis');
  }
  if (typeof onEvent !== 'function') {
    throw new Error('onEvent callback requis');
  }

  const listeners = communitySubscribers.get(actor) ?? new Set();
  listeners.add(onEvent);
  communitySubscribers.set(actor, listeners);

  getUnreadSummary(actor)
    .then((unread) => {
      onEvent({
        event: 'snapshot',
        data: {
          unread,
          connectedAt: new Date().toISOString(),
        },
      });
    })
    .catch(() => {});

  return () => {
    const current = communitySubscribers.get(actor);
    if (!current) {
      return;
    }
    current.delete(onEvent);
    if (current.size === 0) {
      communitySubscribers.delete(actor);
      return;
    }
    communitySubscribers.set(actor, current);
  };
}

export function resetCommunityRealtimeForTests() {
  communitySubscribers.clear();
  lastMessageTs = 0;
}
