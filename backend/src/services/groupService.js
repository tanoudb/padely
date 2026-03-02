import { store } from '../store/index.js';
import { newId } from '../utils/id.js';

const FALLBACK_CLUBS = [
  { key: 'club:urban-padel-lyon', title: 'Urban Padel Lyon', city: 'Lyon', joinCode: 'UP-LYON-01' },
  { key: 'club:esprit-padel-villeurbanne', title: 'Esprit Padel Villeurbanne', city: 'Lyon', joinCode: 'EP-VILLEUR-02' },
  { key: 'club:casa-padel-paris', title: 'Casa Padel Paris', city: 'Paris', joinCode: 'CP-PARIS-01' },
];

function normalize(value) {
  return String(value ?? '').trim();
}

function groupIdFromClubKey(clubKey) {
  return `grp_${String(clubKey).replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
}

async function listClubs() {
  if (typeof store.listClubs === 'function') {
    const clubs = await store.listClubs();
    if (Array.isArray(clubs) && clubs.length) {
      return clubs;
    }
  }
  return FALLBACK_CLUBS;
}

async function ensureClubGroups() {
  const clubs = await listClubs();
  for (const club of clubs) {
    const groupId = groupIdFromClubKey(club.key);
    const current = typeof store.getGroupById === 'function' ? await store.getGroupById(groupId) : null;
    if (current) {
      continue;
    }
    if (typeof store.createGroup === 'function') {
      await store.createGroup({
        id: groupId,
        name: club.title,
        type: 'club',
        createdBy: 'system',
        members: [],
        clubCode: club.joinCode,
        createdAt: new Date().toISOString(),
        lastMessageAt: null,
      });
    }
  }
}

async function requireUser(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

async function requireGroup(groupId) {
  const group = typeof store.getGroupById === 'function' ? await store.getGroupById(groupId) : null;
  if (!group) {
    throw new Error('Group not found');
  }
  return group;
}

function sanitizeMembers(members = []) {
  return [...new Set((members ?? []).map((item) => normalize(item)).filter(Boolean))];
}

function requireGroupMember(group, userId) {
  if (!(group.members ?? []).includes(userId)) {
    throw new Error('Group access denied');
  }
}

function channelKey(groupId) {
  return `group:${groupId}`;
}

function messageId() {
  return `msg_${Date.now()}_${Math.round(Math.random() * 10000)}`;
}

function parseTimeMs(value) {
  const ms = new Date(value ?? '').getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function clampLimit(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export async function listMyGroups(userId) {
  await requireUser(userId);
  await ensureClubGroups();
  const groups = typeof store.listGroupsForUser === 'function'
    ? await store.listGroupsForUser(userId)
    : [];
  return {
    groups: groups.map((group) => ({
      ...group,
      memberCount: Array.isArray(group.members) ? group.members.length : 0,
    })),
  };
}

export async function createGroup({ userId, name, members = [], type = 'private' }) {
  await requireUser(userId);
  if (String(type) !== 'private') {
    throw new Error('Only private groups can be created manually');
  }

  const safeName = normalize(name);
  if (safeName.length < 2) {
    throw new Error('Group name too short');
  }

  const uniqueMembers = sanitizeMembers([userId, ...members]);
  if (uniqueMembers.length > 20) {
    throw new Error('Group member limit is 20');
  }

  for (const memberId of uniqueMembers) {
    await requireUser(memberId);
  }

  const created = await store.createGroup({
    id: newId('grp'),
    name: safeName,
    type: 'private',
    createdBy: userId,
    members: uniqueMembers,
    clubCode: null,
    createdAt: new Date().toISOString(),
    lastMessageAt: null,
  });

  return created;
}

export async function joinGroup({ userId, groupId, clubCode }) {
  await requireUser(userId);
  await ensureClubGroups();

  const group = await requireGroup(groupId);
  if (group.type !== 'club') {
    throw new Error('Only club groups are joinable with a code');
  }

  const expectedCode = normalize(group.clubCode).toLowerCase();
  const givenCode = normalize(clubCode).toLowerCase();
  if (!expectedCode || !givenCode || expectedCode !== givenCode) {
    throw new Error('Invalid club code');
  }

  const updated = await store.addGroupMember(group.id, userId);
  return {
    joined: true,
    group: updated,
  };
}

export async function joinGroupByCode({ userId, clubCode }) {
  await requireUser(userId);
  await ensureClubGroups();

  const safeCode = normalize(clubCode).toLowerCase();
  if (!safeCode) {
    throw new Error('Invalid club code');
  }

  const clubs = await listClubs();
  const club = clubs.find((entry) => normalize(entry?.joinCode).toLowerCase() === safeCode);
  if (!club) {
    throw new Error('Invalid club code');
  }

  const groupId = groupIdFromClubKey(club.key);
  return joinGroup({
    userId,
    groupId,
    clubCode: club.joinCode,
  });
}

export async function leaveGroup({ userId, groupId }) {
  await requireUser(userId);
  const group = await requireGroup(groupId);
  requireGroupMember(group, userId);

  const updated = await store.removeGroupMember(group.id, userId);
  return {
    left: true,
    group: updated,
  };
}

export async function addMembersToGroup({ userId, groupId, members = [] }) {
  await requireUser(userId);
  const group = await requireGroup(groupId);
  if (group.type !== 'private') {
    throw new Error('Members can only be added to private groups');
  }
  if (group.createdBy !== userId) {
    throw new Error('Only group creator can add members');
  }

  const additions = sanitizeMembers(members).filter((memberId) => memberId !== userId);
  const currentMembers = sanitizeMembers(group.members ?? []);
  const nextMembers = sanitizeMembers([...currentMembers, ...additions]);

  if (nextMembers.length > 20) {
    throw new Error('Group member limit is 20');
  }

  for (const memberId of additions) {
    await requireUser(memberId);
  }

  const updated = await store.updateGroup(group.id, {
    members: nextMembers,
  });
  return updated;
}

export async function listGroupMessages({ userId, groupId, limit = 40, before }) {
  await requireUser(userId);
  const group = await requireGroup(groupId);
  requireGroupMember(group, userId);

  const safeLimit = clampLimit(limit, 40, 80);
  const beforeMs = parseTimeMs(before);
  const raw = typeof store.listChannelMessages === 'function'
    ? await store.listChannelMessages(channelKey(groupId), Math.min(260, safeLimit * 4))
    : [];

  const filtered = raw.filter((item) => (beforeMs ? parseTimeMs(item.createdAt) < beforeMs : true));
  const hasMore = filtered.length > safeLimit;
  const items = filtered.slice(Math.max(0, filtered.length - safeLimit));
  const nextCursor = hasMore && items.length > 0 ? items[0].createdAt : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

export async function postGroupMessage({ userId, groupId, text }) {
  const user = await requireUser(userId);
  const group = await requireGroup(groupId);
  requireGroupMember(group, userId);

  const messageText = normalize(text);
  if (!messageText) {
    throw new Error('Message empty');
  }

  const createdAt = new Date().toISOString();
  const item = {
    id: messageId(),
    channel: channelKey(groupId),
    groupId,
    text: messageText,
    senderId: user.id,
    senderName: user.displayName,
    createdAt,
  };

  if (typeof store.addChannelMessage === 'function') {
    await store.addChannelMessage(item);
  }

  await store.updateGroup(group.id, {
    lastMessageAt: createdAt,
  });

  return item;
}

export async function getCommunityFeed(userId, options = {}) {
  const user = await requireUser(userId);
  const limit = clampLimit(options.limit, 30, 100);
  const friendIds = Array.isArray(user.friends) ? user.friends : [];
  const candidateUserIds = [...new Set([user.id, ...friendIds])];
  const matchMap = new Map();

  for (const id of candidateUserIds) {
    const list = await store.listMatchesForUser(id);
    for (const match of list ?? []) {
      if (match?.status !== 'validated') {
        continue;
      }
      matchMap.set(match.id, match);
    }
  }

  const allUsers = await store.listUsers();
  const usersById = new Map(allUsers.map((entry) => [entry.id, entry]));

  const items = [...matchMap.values()]
    .sort((a, b) => new Date(b.validatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.validatedAt ?? a.createdAt ?? 0).getTime())
    .slice(0, limit)
    .map((match) => ({
      id: match.id,
      createdAt: match.validatedAt ?? match.createdAt,
      score: (match.sets ?? []).map((set) => `${set.a}-${set.b}`).join(' / '),
      mode: match.mode,
      stressTag: match.stressTag ?? null,
      isKeyMatch: Boolean(match.isKeyMatch),
      players: (match.players ?? []).map((id) => ({
        id,
        displayName: usersById.get(id)?.displayName ?? 'Player',
      })),
    }));

  return { items };
}
