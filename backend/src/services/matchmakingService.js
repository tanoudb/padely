import { store } from '../store/index.js';
import { addFriend, postPrivateMessage } from './communityService.js';
import { sendPushToUsers } from './pushService.js';

const MAX_RATING_GAP = 150;
const ACTIVE_WINDOW_DAYS = 7;
const WEEK_WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

function toMs(value) {
  const ms = new Date(value ?? '').getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizeCity(value) {
  return String(value ?? '').trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function latestActivityMs(user) {
  const history = Array.isArray(user?.history) ? user.history : [];
  const byHistory = history.reduce((latest, item) => {
    const ms = toMs(item?.at);
    return ms > latest ? ms : latest;
  }, 0);
  const created = toMs(user?.createdAt);
  return Math.max(byHistory, created);
}

function hasPlayedTogetherRecently(myId, candidateId, matches, sinceMs) {
  return matches.some((match) => {
    const playedAt = toMs(match.validatedAt ?? match.createdAt);
    if (playedAt < sinceMs) {
      return false;
    }
    const players = Array.isArray(match.players) ? match.players : [];
    return players.includes(myId) && players.includes(candidateId);
  });
}

function compatibilityScore({ me, candidate, hasRecentHistory, lastActiveMs, nowMs }) {
  const ratingGap = Math.abs(Number(me.rating ?? 1200) - Number(candidate.rating ?? 1200));
  const ratingScore = clamp(Math.round(100 - (ratingGap / MAX_RATING_GAP) * 55), 40, 100);

  const daySinceActive = Math.floor((nowMs - lastActiveMs) / 86_400_000);
  const activityScore = clamp(35 - daySinceActive * 5, 0, 35);

  const historyScore = hasRecentHistory ? 5 : 15;

  return clamp(ratingScore + activityScore + historyScore, 0, 100);
}

function formatLastActive(lastActiveMs) {
  if (!lastActiveMs) {
    return null;
  }
  return new Date(lastActiveMs).toISOString();
}

export async function getMatchmakingSuggestions(userId, options = {}) {
  const me = await store.getUserById(userId);
  if (!me) {
    throw new Error('User not found');
  }

  const city = normalizeCity(options.city ?? me.city);
  if (!city) {
    throw new Error('Ville requise pour le matchmaking');
  }

  const nowMs = Date.now();
  const activeSinceMs = nowMs - ACTIVE_WINDOW_DAYS * 86_400_000;
  const facedSinceMs = nowMs - WEEK_WINDOW_DAYS * 86_400_000;
  const maxSuggestions = clamp(Number(options.limit) || DEFAULT_LIMIT, 1, MAX_LIMIT);

  const allUsers = await store.listUsers();
  const myMatches = await store.listMatchesForUser(me.id);

  const suggestions = allUsers
    .filter((candidate) => {
      if (!candidate || candidate.id === me.id) {
        return false;
      }
      if (normalizeCity(candidate.city) !== city) {
        return false;
      }

      const ratingGap = Math.abs(Number(candidate.rating ?? 0) - Number(me.rating ?? 0));
      if (ratingGap > MAX_RATING_GAP) {
        return false;
      }

      const activeAt = latestActivityMs(candidate);
      if (activeAt < activeSinceMs) {
        return false;
      }

      if (hasPlayedTogetherRecently(me.id, candidate.id, myMatches, facedSinceMs)) {
        return false;
      }

      return true;
    })
    .map((candidate) => {
      const activeAt = latestActivityMs(candidate);
      const hasRecentHistory = hasPlayedTogetherRecently(me.id, candidate.id, myMatches, nowMs - 60 * 86_400_000);
      const compatibility = compatibilityScore({
        me,
        candidate,
        hasRecentHistory,
        lastActiveMs: activeAt,
        nowMs,
      });

      return {
        userId: candidate.id,
        displayName: candidate.displayName,
        city: candidate.city,
        rating: Number(candidate.rating ?? 0),
        pir: Number(candidate.pir ?? 0),
        compatibility,
        ratingGap: Math.abs(Number(candidate.rating ?? 0) - Number(me.rating ?? 0)),
        lastActiveAt: formatLastActive(activeAt),
      };
    })
    .sort((left, right) => {
      if (right.compatibility !== left.compatibility) {
        return right.compatibility - left.compatibility;
      }
      if (left.ratingGap !== right.ratingGap) {
        return left.ratingGap - right.ratingGap;
      }
      return String(left.displayName ?? '').localeCompare(String(right.displayName ?? ''));
    })
    .slice(0, maxSuggestions);

  return {
    city: me.city ?? options.city,
    generatedAt: new Date(nowMs).toISOString(),
    count: suggestions.length,
    suggestions,
  };
}

export async function proposeMatchmakingInvite({ fromUserId, targetUserId, message }) {
  if (!targetUserId || fromUserId === targetUserId) {
    throw new Error('targetUserId invalide');
  }

  const from = await store.getUserById(fromUserId);
  const target = await store.getUserById(targetUserId);
  if (!from || !target) {
    throw new Error('Utilisateur introuvable');
  }

  await addFriend(fromUserId, targetUserId);

  const note = String(message ?? '').trim();
  const text = note.length > 0
    ? `Invitation match Padely: ${note}`
    : `${from.displayName} te propose un match Padely cette semaine.`;

  const dm = await postPrivateMessage({
    fromUserId,
    toUserId: targetUserId,
    text,
  });

  await sendPushToUsers([targetUserId], {
    title: 'Nouveau defi Padely',
    body: `${from.displayName} veut jouer un match avec toi.`,
    data: {
      type: 'matchmaking_invite',
      fromUserId,
      profileUserId: fromUserId,
    },
  });

  return {
    invited: true,
    targetUserId,
    messageId: dm.id,
    createdAt: dm.createdAt,
  };
}
