import { inactivityDecay, softReset } from '../domain/pir.js';
import { store } from '../store/index.js';

export const BADGE_CATALOG = [
  {
    key: 'first_blood',
    title: 'First Blood',
    description: 'Valider ton tout premier match.',
  },
  {
    key: 'serial_winner',
    title: 'Serial Winner',
    description: 'Enchainer 6 victoires consecutives.',
  },
  {
    key: 'ironman',
    title: 'Ironman',
    description: 'Jouer 30 matchs valides.',
  },
  {
    key: 'upset_king',
    title: 'Upset King',
    description: 'Gagner un match avec au moins 180 pts de retard.',
  },
  {
    key: 'golden_touch',
    title: 'Golden Touch',
    description: 'Cumuler 15 puntos de oro gagnants.',
  },
  {
    key: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Construire un vrai reseau local actif.',
  },
  {
    key: 'city_champion',
    title: 'City Champion',
    description: 'Atteindre la place #1 du classement de ta ville.',
  },
  {
    key: 'marathon_man',
    title: 'Marathon Man',
    description: 'Cumuler 15h de jeu ou 5 matchs format Marathon.',
  },
];

function didUserWin(match, userId) {
  const sets = Array.isArray(match?.sets) ? match.sets : [];
  const teamASets = sets.filter((set) => Number(set?.a ?? 0) > Number(set?.b ?? 0)).length;
  const teamBSets = sets.filter((set) => Number(set?.b ?? 0) > Number(set?.a ?? 0)).length;
  const winner = teamASets >= teamBSets ? 'A' : 'B';
  const inTeamA = Array.isArray(match?.teamA) && match.teamA.includes(userId);
  return (inTeamA && winner === 'A') || (!inTeamA && winner === 'B');
}

function safeAverage(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateMatchMinutes(match) {
  const sets = Array.isArray(match?.sets) ? match.sets : [];
  const totalGames = sets.reduce(
    (sum, set) => sum + (Number(set?.a ?? 0) || 0) + (Number(set?.b ?? 0) || 0),
    0,
  );
  return Math.round(totalGames * 3.2);
}

function findTeamForUser(match, userId) {
  if ((match?.teamA ?? []).includes(userId)) return 'A';
  if ((match?.teamB ?? []).includes(userId)) return 'B';
  return null;
}

function snapshotRatings(match, teamKey) {
  const snapshots = match?.usersSnapshot?.[teamKey] ?? [];
  const participantSnapshots = match?.participants?.[teamKey] ?? [];

  if (Array.isArray(snapshots) && snapshots.length) {
    return snapshots
      .map((entry) => Number(entry?.rating ?? entry?.guestRating))
      .filter((value) => Number.isFinite(value));
  }

  if (Array.isArray(participantSnapshots) && participantSnapshots.length) {
    return participantSnapshots
      .map((entry) => Number(entry?.rating ?? entry?.guestRating))
      .filter((value) => Number.isFinite(value));
  }

  return [];
}

function computeBiggestUpset(matches, userId) {
  let biggestGap = 0;

  for (const match of matches) {
    if (!didUserWin(match, userId)) {
      continue;
    }

    const myTeam = findTeamForUser(match, userId);
    if (!myTeam) {
      continue;
    }

    const oppTeam = myTeam === 'A' ? 'B' : 'A';
    const myAvg = safeAverage(snapshotRatings(match, `team${myTeam}`));
    const oppAvg = safeAverage(snapshotRatings(match, `team${oppTeam}`));
    const gap = Math.max(0, Math.round(oppAvg - myAvg));
    biggestGap = Math.max(biggestGap, gap);
  }

  return biggestGap;
}

function computeCurrentWinStreak(matches, userId) {
  if (!matches.length) {
    return 0;
  }
  let streak = 0;
  const sorted = [...matches].sort((a, b) => {
    const at = new Date(a?.validatedAt ?? a?.createdAt ?? 0).getTime();
    const bt = new Date(b?.validatedAt ?? b?.createdAt ?? 0).getTime();
    return at - bt;
  });

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (!didUserWin(sorted[index], userId)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function normalizeCity(city) {
  return String(city ?? '').trim().toLowerCase();
}

async function isCityChampion(user) {
  const city = String(user?.city ?? '').trim();
  if (!city) {
    return false;
  }

  let rows = [];
  if (typeof store.getLeaderboard === 'function') {
    rows = await store.getLeaderboard(city);
  }
  if (!rows.length && typeof store.listUsers === 'function') {
    const users = await store.listUsers();
    rows = users
      .filter((entry) => normalizeCity(entry.city) === normalizeCity(city))
      .sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0))
      .map((entry, index) => ({
        rank: index + 1,
        userId: entry.id,
        rating: entry.rating,
        pir: entry.pir,
      }));
  }

  return rows[0]?.userId === user.id;
}

async function computeSocialScore(user) {
  const friends = Array.isArray(user?.friends) ? user.friends : [];
  const clubs = Array.isArray(user?.community?.joinedClubChannels)
    ? user.community.joinedClubChannels
    : [];

  let dmVolume = 0;
  if (typeof store.listPrivateMessages === 'function') {
    for (const friendId of friends) {
      const thread = await store.listPrivateMessages(user.id, friendId, 120);
      dmVolume += Array.isArray(thread) ? thread.length : 0;
    }
  }

  return {
    friendsCount: friends.length,
    clubsCount: clubs.length,
    dmVolume,
  };
}

async function buildBadgeContext(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const matches = (await store.listMatchesForUser(userId)).filter((m) => m.status === 'validated');
  const wins = matches.filter((match) => didUserWin(match, userId)).length;
  const currentWinStreak = computeCurrentWinStreak(matches, userId);
  const totalGoldenPointsWon = matches.reduce((sum, match) => {
    const team = findTeamForUser(match, userId);
    if (team === 'A') return sum + (Number(match?.goldenPoints?.teamA ?? 0) || 0);
    if (team === 'B') return sum + (Number(match?.goldenPoints?.teamB ?? 0) || 0);
    return sum;
  }, 0);
  const marathonMatches = matches.filter((match) => match?.matchFormat === 'marathon').length;
  const totalMinutes = matches.reduce((sum, match) => sum + estimateMatchMinutes(match), 0);
  const biggestUpset = computeBiggestUpset(matches, userId);
  const social = await computeSocialScore(user);
  const cityChampion = await isCityChampion(user);

  return {
    user,
    matches,
    wins,
    currentWinStreak,
    totalGoldenPointsWon,
    marathonMatches,
    totalMinutes,
    biggestUpset,
    social,
    cityChampion,
  };
}

function resolveUnlockedBadges(context) {
  const unlocked = [];
  if (context.matches.length >= 1) {
    unlocked.push({ key: 'first_blood', progress: context.matches.length });
  }
  if (context.currentWinStreak >= 6) {
    unlocked.push({ key: 'serial_winner', progress: context.currentWinStreak });
  }
  if (context.matches.length >= 30) {
    unlocked.push({ key: 'ironman', progress: context.matches.length });
  }
  if (context.biggestUpset >= 180) {
    unlocked.push({ key: 'upset_king', progress: context.biggestUpset });
  }
  if (context.totalGoldenPointsWon >= 15) {
    unlocked.push({ key: 'golden_touch', progress: context.totalGoldenPointsWon });
  }
  const socialUnlocked = context.social.friendsCount >= 8
    || (context.social.friendsCount >= 4 && context.social.dmVolume >= 20)
    || context.social.clubsCount >= 2;
  if (socialUnlocked) {
    unlocked.push({ key: 'social_butterfly', progress: context.social.friendsCount });
  }
  if (context.cityChampion) {
    unlocked.push({ key: 'city_champion', progress: 1 });
  }
  if (context.totalMinutes >= 900 || context.marathonMatches >= 5) {
    unlocked.push({ key: 'marathon_man', progress: Math.max(context.totalMinutes, context.marathonMatches) });
  }

  return unlocked;
}

function enrichCatalog(persisted = []) {
  const byKey = new Map((persisted ?? []).map((entry) => [entry.badgeKey, entry]));
  return BADGE_CATALOG.map((badge) => {
    const unlocked = byKey.get(badge.key);
    return {
      ...badge,
      unlocked: Boolean(unlocked),
      unlockedAt: unlocked?.unlockedAt ?? null,
      meta: unlocked?.meta ?? null,
    };
  });
}

export async function evaluateBadges(userId, options = {}) {
  const source = String(options?.source ?? 'evaluateBadges');
  const context = await buildBadgeContext(userId);
  const unlockedTargets = resolveUnlockedBadges(context);
  const unlockedKeys = unlockedTargets.map((item) => item.key);

  const storedUnlocks = [];
  if (typeof store.unlockBadge === 'function') {
    for (const item of unlockedTargets) {
      const result = await store.unlockBadge(userId, item.key, {
        source,
        progress: item.progress,
        wins: context.wins,
        matches: context.matches.length,
        winStreak: context.currentWinStreak,
        biggestUpset: context.biggestUpset,
        goldenPointsWon: context.totalGoldenPointsWon,
        marathonMatches: context.marathonMatches,
        totalMinutes: context.totalMinutes,
        social: context.social,
        evaluatedAt: new Date().toISOString(),
      });
      storedUnlocks.push({
        badgeKey: item.key,
        title: BADGE_CATALOG.find((badge) => badge.key === item.key)?.title ?? item.key,
        unlockedAt: result.unlockedAt,
        isNew: result.created,
        meta: result.meta ?? {},
      });
    }
  }

  const persisted = typeof store.listBadgesForUser === 'function'
    ? await store.listBadgesForUser(userId)
    : unlockedKeys.map((badgeKey) => ({ badgeKey, unlockedAt: null, meta: {} }));

  const newlyUnlocked = storedUnlocks.filter((item) => item.isNew);

  return {
    userId,
    badges: persisted.map((entry) => entry.badgeKey),
    catalog: enrichCatalog(persisted),
    unlocked: storedUnlocks,
    newlyUnlocked,
    total: persisted.length,
    stats: {
      matches: context.matches.length,
      wins: context.wins,
      currentWinStreak: context.currentWinStreak,
      biggestUpset: context.biggestUpset,
      goldenPointsWon: context.totalGoldenPointsWon,
      marathonMatches: context.marathonMatches,
      totalMinutes: context.totalMinutes,
      social: context.social,
      cityChampion: context.cityChampion,
    },
  };
}

export async function runSeasonSoftReset() {
  const users = await store.listUsers();
  const updates = [];

  for (const user of users) {
    const newRating = softReset(user.rating);
    const currentPir = Number(user.pir ?? 50);
    const nextPir = Number((50 + (currentPir - 50) * 0.45).toFixed(2));
    await store.updateUser(user.id, {
      rating: newRating,
      pir: nextPir,
    });
    updates.push({
      userId: user.id,
      previous: user.rating,
      next: newRating,
      previousPir: currentPir,
      nextPir,
    });
  }

  return updates;
}

export async function runInactivityDecay(referenceDateIso = new Date().toISOString()) {
  const ref = new Date(referenceDateIso);
  const users = await store.listUsers();
  const updates = [];

  for (const user of users) {
    const lastGame = (user.history ?? []).at(-1)?.at;
    if (!lastGame) {
      continue;
    }

    const weeks = Math.floor((ref.getTime() - new Date(lastGame).getTime()) / (1000 * 60 * 60 * 24 * 7));
    const next = inactivityDecay({
      rating: user.rating,
      weeksInactive: weeks,
    });

    if (next !== user.rating) {
      await store.updateUser(user.id, { rating: next });
      updates.push({ userId: user.id, previous: user.rating, next, weeksInactive: weeks });
    }
  }

  return updates;
}
