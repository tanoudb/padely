import { store } from '../store/index.js';
import { findBalancedMatches } from '../engine/matchmaking.js';

const channelMessages = new Map();
const privateMessages = new Map();

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

function cityChannelKey(city) {
  return `city:${city.toLowerCase()}`;
}

function pairMessageKey(userA, userB) {
  return [userA, userB].sort().join(':');
}

function ensureChannelSeed(channel, label) {
  if (!channelMessages.has(channel)) {
    channelMessages.set(channel, [
      {
        id: `msg_${Date.now()}`,
        channel,
        text: `Bienvenue dans le canal ${label}`,
        senderName: 'Padely Bot',
        senderId: 'system',
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

function safeProfile(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    rating: user.rating,
    pir: user.pir,
    city: user.city,
  };
}

export async function getCrewOverview(userId, cityOverride) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const city = (cityOverride ?? user.city ?? 'Lyon').trim();
  const regionKey = cityChannelKey(city);
  ensureChannelSeed('france', 'France');
  ensureChannelSeed(regionKey, city);

  const leaderboard = await getCityLeaderboard(city);
  const friendIds = user.friends ?? [];
  const friendUsers = await Promise.all(friendIds.map((id) => store.getUserById(id)));

  return {
    channels: [
      {
        key: 'france',
        title: 'Groupe France',
        scope: 'global',
        city: null,
      },
      {
        key: regionKey,
        title: `Groupe ${city}`,
        scope: 'regional',
        city,
      },
    ],
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

  const item = {
    id: `msg_${Date.now()}_${Math.round(Math.random() * 9999)}`,
    channel,
    text: text.trim(),
    senderName: user.displayName,
    senderId: user.id,
    createdAt: new Date().toISOString(),
  };
  if (!channelMessages.has(channel)) {
    channelMessages.set(channel, []);
  }
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
