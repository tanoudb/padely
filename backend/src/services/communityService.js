import { store } from '../store/index.js';
import { findBalancedMatches } from '../engine/matchmaking.js';

const channelMessages = new Map();
const privateMessages = new Map();

const CLUB_CHANNELS = [
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

function pairMessageKey(userA, userB) {
  return [userA, userB].sort().join(':');
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

function ensureChannelSeed(channel, label) {
  if (!channelMessages.has(channel)) {
    channelMessages.set(channel, [
      {
        id: `msg_${Date.now()}`,
        channel,
        text: `Bienvenue dans le canal ${label}.`,
        senderName: 'Padely Bot',
        senderId: 'system',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

function channelTitleFromKey(channel) {
  if (channel === 'france') return 'Canal France';
  if (isRegionalChannel(channel)) {
    const city = channel.split(':')[1] ?? 'region';
    return `Canal ${city.charAt(0).toUpperCase()}${city.slice(1)}`;
  }
  if (isClubChannel(channel)) {
    const club = CLUB_CHANNELS.find((c) => c.key === channel);
    return club?.title ?? 'Canal club';
  }
  if (isCustomChannel(channel)) {
    const name = channel.split(':')[1] ?? 'canal';
    return `Canal ${name.replaceAll('-', ' ')}`;
  }
  return 'Canal';
}

function getCommunityState(user) {
  return user.community ?? {
    customChannels: [],
    joinedClubChannels: [],
  };
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

function getClubByCode(code) {
  const safe = normalizedLower(code);
  return CLUB_CHANNELS.find((club) => normalizedLower(club.joinCode) === safe) ?? null;
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

  ensureChannelSeed(channelKey, name);

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

  const club = getClubByCode(code);
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

  ensureChannelSeed(club.key, club.title);

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
  ensureChannelSeed('france', 'France');
  ensureChannelSeed(regionKey, city);

  const leaderboard = await getCityLeaderboard(city);
  const friendIds = user.friends ?? [];
  const friendUsers = await Promise.all(friendIds.map((id) => store.getUserById(id)));

  const community = getCommunityState(user);
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
    ...community.customChannels.map((key) => ({
      key,
      title: channelTitleFromKey(key),
      type: 'custom',
    })),
  ];

  const clubChannels = community.joinedClubChannels.map((key) => {
    const club = CLUB_CHANNELS.find((item) => item.key === key);
    return {
      key,
      title: club?.title ?? channelTitleFromKey(key),
      type: 'club',
      city: club?.city ?? city,
      joined: true,
    };
  });

  const availableClubs = CLUB_CHANNELS.filter((club) =>
    normalizedLower(club.city) === normalizedLower(city)
  ).map((club) => ({
    key: club.key,
    title: club.title,
    city: club.city,
    joined: community.joinedClubChannels.includes(club.key),
  }));

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
  };
}

export async function listChannelMessages(channel, limit = 40) {
  const items = channelMessages.get(channel) ?? [];
  return items.slice(-Math.max(1, Math.min(100, limit)));
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

  ensureChannelSeed(channel, channelTitleFromKey(channel));

  const item = {
    id: `msg_${Date.now()}_${Math.round(Math.random() * 9999)}`,
    channel,
    text: text.trim(),
    senderName: user.displayName,
    senderId: user.id,
    createdAt: new Date().toISOString(),
  };

  channelMessages.get(channel).push(item);
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
  const key = pairMessageKey(userId, friendId);
  const items = privateMessages.get(key) ?? [];
  return items.slice(-Math.max(1, Math.min(150, limit)));
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

  const key = pairMessageKey(fromUserId, toUserId);
  if (!privateMessages.has(key)) {
    privateMessages.set(key, []);
  }
  const message = {
    id: `dm_${Date.now()}_${Math.round(Math.random() * 9999)}`,
    fromUserId,
    toUserId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  privateMessages.get(key).push(message);
  return message;
}
