import { inactivityDecay, softReset } from '../domain/pir.js';
import { store } from '../store/index.js';

const DAY_MS = 86_400_000;
const BADGE_TIER_ORDER = ['bronze', 'silver', 'gold', 'mythic'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const BADGE_CATALOG_V2 = [
  {
    key: 'metronome',
    category: 'style',
    title: 'Le Metronome',
    levels: [
      { tier: 'bronze', threshold: 5, label: '5 matchs reguliers' },
      { tier: 'silver', threshold: 15, label: '15 matchs reguliers' },
      { tier: 'gold', threshold: 40, label: '40 matchs reguliers' },
      { tier: 'mythic', threshold: 100, label: 'Legende de la constance' },
    ],
  },
  {
    key: 'warrior',
    category: 'style',
    title: 'Le Guerrier',
    levels: [
      { tier: 'bronze', threshold: 3, label: '3 matchs serres gagnes' },
      { tier: 'silver', threshold: 10, label: '10 matchs serres gagnes' },
      { tier: 'gold', threshold: 30, label: '30 matchs serres gagnes' },
      { tier: 'mythic', threshold: 75, label: 'Machine de combat' },
    ],
  },
  {
    key: 'sniper',
    category: 'style',
    title: 'Le Sniper',
    levels: [
      { tier: 'bronze', threshold: 20, label: '20 puntos de oro gagnes' },
      { tier: 'silver', threshold: 50, label: '50 puntos de oro' },
      { tier: 'gold', threshold: 120, label: '120 puntos de oro' },
      { tier: 'mythic', threshold: 300, label: 'Clutch absolu' },
    ],
  },
  {
    key: 'survivor',
    category: 'style',
    title: 'Le Survivant',
    levels: [
      { tier: 'bronze', threshold: 1, label: '1 comeback' },
      { tier: 'silver', threshold: 5, label: '5 comebacks' },
      { tier: 'gold', threshold: 15, label: '15 comebacks' },
      { tier: 'mythic', threshold: 40, label: 'Immortel' },
    ],
  },
  {
    key: 'strategist',
    category: 'style',
    title: 'Le Stratege',
    levels: [
      { tier: 'bronze', threshold: 2, label: '2 upsets' },
      { tier: 'silver', threshold: 8, label: '8 upsets' },
      { tier: 'gold', threshold: 20, label: '20 upsets' },
      { tier: 'mythic', threshold: 50, label: 'Giant Killer' },
    ],
  },
  {
    key: 'first_blood',
    category: 'moment',
    title: 'Premier match',
    levels: [{ tier: 'gold', threshold: 1 }],
  },
  {
    key: 'remontada',
    category: 'moment',
    title: 'Remontada',
    levels: [{ tier: 'gold', threshold: 1 }],
  },
  {
    key: 'comeback_60',
    category: 'moment',
    title: 'Retour apres 60 jours',
    levels: [{ tier: 'gold', threshold: 1 }],
  },
  {
    key: 'tiebreak_infinite',
    category: 'moment',
    title: 'Tie-break infini',
    levels: [{ tier: 'gold', threshold: 1 }],
  },
  {
    key: 'first_win',
    category: 'journey',
    title: 'Premiere victoire',
    levels: [{ tier: 'gold', threshold: 1 }],
  },
  {
    key: 'serial_winner',
    category: 'journey',
    title: 'Serie de 5',
    levels: [
      { tier: 'bronze', threshold: 1, label: '1 serie de 5' },
      { tier: 'silver', threshold: 3, label: '3 series de 5' },
      { tier: 'gold', threshold: 8, label: '8 series de 5' },
      { tier: 'mythic', threshold: 20, label: 'Invincible' },
    ],
  },
  {
    key: 'new_cap',
    category: 'journey',
    title: 'Nouveau cap',
    levels: [
      { tier: 'bronze', threshold: 1, label: 'Premier palier PIR' },
      { tier: 'silver', threshold: 3, label: '3 paliers PIR' },
      { tier: 'gold', threshold: 6, label: '6 paliers PIR' },
    ],
  },
  {
    key: 'nail_biter',
    category: 'secret',
    title: '???',
    revealedTitle: 'Cardiologue',
    levels: [{ tier: 'mythic', threshold: 3, label: 'Gagner 3 fois de suite a 1 point' }],
    hidden: true,
  },
  {
    key: 'ironman',
    category: 'journey',
    title: 'Ironman',
    levels: [
      { tier: 'bronze', threshold: 10, label: '10 matchs' },
      { tier: 'silver', threshold: 30, label: '30 matchs' },
      { tier: 'gold', threshold: 75, label: '75 matchs' },
      { tier: 'mythic', threshold: 200, label: 'Legende du terrain' },
    ],
  },
  {
    key: 'social_butterfly',
    category: 'style',
    title: 'Papillon social',
    levels: [
      { tier: 'bronze', threshold: 1, label: '4 amis' },
      { tier: 'silver', threshold: 2, label: '8 amis + DMs actifs' },
      { tier: 'gold', threshold: 3, label: '15 amis + 2 clubs' },
    ],
  },
  {
    key: 'city_champion',
    category: 'moment',
    title: 'Champion de la ville',
    levels: [{ tier: 'mythic', threshold: 1 }],
  },
  {
    key: 'best_duo',
    category: 'style',
    title: 'Duo parfait',
    levels: [
      { tier: 'bronze', threshold: 5, label: '5 matchs avec meme partenaire' },
      { tier: 'silver', threshold: 15, label: '15 matchs, 60%+ winrate' },
      { tier: 'gold', threshold: 30, label: '30 matchs, 65%+ winrate' },
      { tier: 'mythic', threshold: 50, label: 'Binome legendaire' },
    ],
  },
];

export const BADGE_CATALOG = BADGE_CATALOG_V2;

function normalizeBadgeTier(value, fallback = null) {
  const raw = String(value ?? '').toLowerCase();
  if (BADGE_TIER_ORDER.includes(raw)) {
    return raw;
  }
  return fallback;
}

function tierIndex(tier) {
  return BADGE_TIER_ORDER.indexOf(normalizeBadgeTier(tier, 'bronze'));
}

function compareTier(nextTier, previousTier) {
  return tierIndex(nextTier) - tierIndex(previousTier);
}

function normalizeCity(city) {
  return String(city ?? '').trim().toLowerCase();
}

function safeAverage(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function matchTimeMs(match) {
  const raw = match?.validatedAt ?? match?.createdAt;
  const ms = new Date(raw ?? 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function didUserWin(match, userId) {
  const sets = Array.isArray(match?.sets) ? match.sets : [];
  const teamASets = sets.filter((set) => Number(set?.a ?? 0) > Number(set?.b ?? 0)).length;
  const teamBSets = sets.filter((set) => Number(set?.b ?? 0) > Number(set?.a ?? 0)).length;
  const winner = teamASets >= teamBSets ? 'A' : 'B';
  const inTeamA = Array.isArray(match?.teamA) && match.teamA.includes(userId);
  return (inTeamA && winner === 'A') || (!inTeamA && winner === 'B');
}

function findTeamForUser(match, userId) {
  if ((match?.teamA ?? []).includes(userId)) return 'A';
  if ((match?.teamB ?? []).includes(userId)) return 'B';
  return null;
}

function participantsForMatch(match, teamKey) {
  const fromParticipants = match?.participants?.[teamKey];
  if (Array.isArray(fromParticipants) && fromParticipants.length) {
    return fromParticipants;
  }
  return (match?.[teamKey] ?? []).map((userId) => ({
    kind: 'user',
    userId,
  }));
}

function snapshotRatings(match, teamKey, usersById) {
  const snapshot = match?.usersSnapshot?.[teamKey] ?? [];
  if (Array.isArray(snapshot) && snapshot.length) {
    const values = snapshot
      .map((entry) => Number(entry?.rating ?? entry?.guestRating))
      .filter((value) => Number.isFinite(value));
    if (values.length) {
      return values;
    }
  }

  const participants = participantsForMatch(match, teamKey);
  return participants
    .map((slot) => {
      if (slot?.kind === 'guest') {
        return Number(slot?.guestRating ?? 0);
      }
      return Number(usersById.get(slot?.userId)?.rating ?? 0);
    })
    .filter((value) => Number.isFinite(value) && value > 0);
}

function matchMarginForUser(match, userId) {
  const isTeamA = (match?.teamA ?? []).includes(userId);
  return (match?.sets ?? []).reduce((sum, set) => {
    const a = Number(set?.a ?? 0);
    const b = Number(set?.b ?? 0);
    return sum + (isTeamA ? (a - b) : (b - a));
  }, 0);
}

function ratingMilestonesCrossed(user) {
  const thresholds = [1300, 1500, 1700, 1900, 2100];
  const history = Array.isArray(user?.history) ? user.history : [];
  if (!history.length) return 0;
  const values = history.map((entry) => Number(entry?.rating ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  const maxRating = Math.max(...values, Number(user?.rating ?? 0));
  return thresholds.filter((threshold) => maxRating >= threshold).length;
}

function countWinStreaksAtLeast(matches, userId, size = 5) {
  const sorted = [...matches].sort((a, b) => matchTimeMs(a) - matchTimeMs(b));
  let streak = 0;
  let total = 0;
  for (const match of sorted) {
    if (didUserWin(match, userId)) {
      streak += 1;
      if (streak === size) {
        total += 1;
      } else if (streak > size) {
        total += 1;
      }
      continue;
    }
    streak = 0;
  }
  return total;
}

function countCombacks(matches, userId) {
  let total = 0;
  for (const match of matches) {
    const sets = match?.sets ?? [];
    if (!sets.length || !didUserWin(match, userId)) continue;
    const isTeamA = (match?.teamA ?? []).includes(userId);
    const firstA = Number(sets[0]?.a ?? 0);
    const firstB = Number(sets[0]?.b ?? 0);
    const lostFirstSet = isTeamA ? firstA < firstB : firstB < firstA;
    if (lostFirstSet) {
      total += 1;
    }
  }
  return total;
}

function countUpsets(matches, userId, usersById) {
  let total = 0;
  for (const match of matches) {
    if (!didUserWin(match, userId)) continue;
    const myTeam = findTeamForUser(match, userId);
    if (!myTeam) continue;
    const oppTeam = myTeam === 'A' ? 'B' : 'A';
    const myAvg = safeAverage(snapshotRatings(match, `team${myTeam}`, usersById));
    const oppAvg = safeAverage(snapshotRatings(match, `team${oppTeam}`, usersById));
    if (oppAvg - myAvg >= 100) {
      total += 1;
    }
  }
  return total;
}

function countTieBreakInfinite(matches) {
  return matches.filter((match) => (match?.sets ?? []).some((set) => {
    const a = Number(set?.a ?? 0);
    const b = Number(set?.b ?? 0);
    return (a === 7 && b === 6) || (a === 6 && b === 7);
  })).length;
}

function countComeback60(matches) {
  const sorted = [...matches].sort((a, b) => matchTimeMs(a) - matchTimeMs(b));
  let total = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previousMs = matchTimeMs(sorted[index - 1]);
    const currentMs = matchTimeMs(sorted[index]);
    if (!previousMs || !currentMs) continue;
    const diff = Math.floor((currentMs - previousMs) / DAY_MS);
    if (diff >= 60) {
      total += 1;
    }
  }
  return total;
}

function countNailBiterStreaks(matches, userId) {
  const sorted = [...matches].sort((a, b) => matchTimeMs(a) - matchTimeMs(b));
  let streak = 0;
  let bestStreak = 0;
  for (const match of sorted) {
    const margin = Math.abs(matchMarginForUser(match, userId));
    if (didUserWin(match, userId) && margin <= 1) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      continue;
    }
    streak = 0;
  }
  return bestStreak;
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
      }));
  }
  return rows[0]?.userId === user.id;
}

function computeBestDuo(matches, userId) {
  const duoMap = new Map();
  for (const match of matches) {
    const teamA = participantsForMatch(match, 'teamA');
    const teamB = participantsForMatch(match, 'teamB');
    const myTeam = teamA.some((slot) => slot.kind === 'user' && slot.userId === userId) ? teamA : teamB;
    const partner = myTeam.find((slot) => slot.kind === 'user' && slot.userId !== userId);
    if (!partner?.userId) continue;

    if (!duoMap.has(partner.userId)) {
      duoMap.set(partner.userId, {
        partnerId: partner.userId,
        matches: 0,
        wins: 0,
        lastMatchAt: null,
      });
    }

    const row = duoMap.get(partner.userId);
    row.matches += 1;
    if (didUserWin(match, userId)) {
      row.wins += 1;
    }
    const at = match?.validatedAt ?? match?.createdAt ?? null;
    if (at && (!row.lastMatchAt || new Date(at).getTime() > new Date(row.lastMatchAt).getTime())) {
      row.lastMatchAt = at;
    }
  }

  const rows = [...duoMap.values()].map((item) => ({
    ...item,
    winRate: item.matches ? Number(((item.wins / item.matches) * 100).toFixed(1)) : 0,
  }));
  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });
  return rows[0] ?? null;
}

async function buildBadgeContext(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const users = await store.listUsers();
  const usersById = new Map(users.map((entry) => [entry.id, entry]));
  const matches = (await store.listMatchesForUser(userId)).filter((m) => m.status === 'validated');
  const sortedMatches = [...matches].sort((a, b) => matchTimeMs(a) - matchTimeMs(b));
  const wins = sortedMatches.filter((match) => didUserWin(match, userId)).length;
  const closeWins = sortedMatches.filter((match) => didUserWin(match, userId) && Math.abs(matchMarginForUser(match, userId)) <= 3).length;
  const totalGoldenPointsWon = sortedMatches.reduce((sum, match) => {
    const team = findTeamForUser(match, userId);
    if (team === 'A') return sum + (Number(match?.goldenPoints?.teamA ?? 0) || 0);
    if (team === 'B') return sum + (Number(match?.goldenPoints?.teamB ?? 0) || 0);
    return sum;
  }, 0);
  const comebacks = countCombacks(sortedMatches, userId);
  const upsets = countUpsets(sortedMatches, userId, usersById);
  const social = await computeSocialScore(user);
  const cityChampion = await isCityChampion(user);
  const bestDuo = computeBestDuo(sortedMatches, userId);
  const streaks5 = countWinStreaksAtLeast(sortedMatches, userId, 5);
  const comeback60 = countComeback60(sortedMatches);
  const tieBreakInfinite = countTieBreakInfinite(sortedMatches);
  const nailBiterRuns = countNailBiterStreaks(sortedMatches, userId);
  const pirCaps = ratingMilestonesCrossed(user);
  const hasFirstWin = wins >= 1;
  const firstBlood = sortedMatches.length >= 1;
  const hasRemontada = comebacks >= 1;

  return {
    user,
    matches: sortedMatches,
    wins,
    closeWins,
    totalGoldenPointsWon,
    comebacks,
    upsets,
    social,
    cityChampion,
    bestDuo,
    streaks5,
    comeback60,
    tieBreakInfinite,
    nailBiterRuns,
    pirCaps,
    hasFirstWin,
    firstBlood,
    hasRemontada,
  };
}

function resolveTierFromProgress(levels = [], progress = 0) {
  const sortedLevels = [...levels].sort((a, b) => Number(a.threshold ?? 0) - Number(b.threshold ?? 0));
  let tier = null;
  for (const level of sortedLevels) {
    if (progress >= Number(level.threshold ?? 0)) {
      tier = normalizeBadgeTier(level.tier, null);
    }
  }
  return tier;
}

function nextTierForProgress(levels = [], currentTier, progress = 0) {
  const sorted = [...levels].sort((a, b) => Number(a.threshold ?? 0) - Number(b.threshold ?? 0));
  const currentIndex = sorted.findIndex((level) => normalizeBadgeTier(level.tier, null) === normalizeBadgeTier(currentTier, null));
  const next = currentIndex >= 0 ? sorted[currentIndex + 1] : sorted.find((level) => Number(level.threshold ?? 0) > progress);
  if (!next) {
    return null;
  }
  const threshold = Number(next.threshold ?? 0);
  const previousThreshold = currentIndex >= 0 ? Number(sorted[currentIndex]?.threshold ?? 0) : 0;
  const slice = Math.max(1, threshold - previousThreshold);
  const inSlice = clamp(progress - previousThreshold, 0, slice);
  return {
    tier: normalizeBadgeTier(next.tier, null),
    threshold,
    progressPercent: Math.round((inSlice / slice) * 100),
  };
}

function evaluateCatalogProgress(context) {
  const bestDuo = context.bestDuo ?? { matches: 0, winRate: 0 };
  const social = context.social ?? { friendsCount: 0, clubsCount: 0, dmVolume: 0 };
  const dmActive = social.dmVolume >= 12;

  return BADGE_CATALOG.map((badge) => {
    let progress = 0;
    let forcedTier = null;

    switch (badge.key) {
      case 'metronome':
        progress = context.matches.length;
        break;
      case 'warrior':
        progress = context.closeWins;
        break;
      case 'sniper':
        progress = context.totalGoldenPointsWon;
        break;
      case 'survivor':
        progress = context.comebacks;
        break;
      case 'strategist':
        progress = context.upsets;
        break;
      case 'first_blood':
        progress = context.firstBlood ? 1 : 0;
        break;
      case 'remontada':
        progress = context.hasRemontada ? 1 : 0;
        break;
      case 'comeback_60':
        progress = context.comeback60;
        break;
      case 'tiebreak_infinite':
        progress = context.tieBreakInfinite;
        break;
      case 'first_win':
        progress = context.hasFirstWin ? 1 : 0;
        break;
      case 'serial_winner':
        progress = context.streaks5;
        break;
      case 'new_cap':
        progress = context.pirCaps;
        break;
      case 'nail_biter':
        progress = context.nailBiterRuns;
        break;
      case 'ironman':
        progress = context.matches.length;
        break;
      case 'social_butterfly':
        progress = 0;
        if (social.friendsCount >= 4) {
          progress = 1;
        }
        if (social.friendsCount >= 8 && dmActive) {
          progress = Math.max(progress, 2);
        }
        if (social.friendsCount >= 15 && social.clubsCount >= 2) {
          progress = Math.max(progress, 3);
        }
        break;
      case 'city_champion':
        progress = context.cityChampion ? 1 : 0;
        break;
      case 'best_duo':
        progress = bestDuo.matches;
        if (bestDuo.matches >= 50 && bestDuo.winRate >= 65) forcedTier = 'mythic';
        else if (bestDuo.matches >= 30 && bestDuo.winRate >= 65) forcedTier = 'gold';
        else if (bestDuo.matches >= 15 && bestDuo.winRate >= 60) forcedTier = 'silver';
        else if (bestDuo.matches >= 5) forcedTier = 'bronze';
        break;
      default:
        break;
    }

    const tier = forcedTier ?? resolveTierFromProgress(badge.levels, progress);
    return {
      badge,
      key: badge.key,
      progress,
      tier: normalizeBadgeTier(tier, null),
    };
  });
}

function enrichCatalog(persisted = [], progressMap = new Map()) {
  const byKey = new Map((persisted ?? []).map((entry) => [entry.badgeKey, entry]));
  return BADGE_CATALOG.map((badge) => {
    const unlocked = byKey.get(badge.key);
    const progress = progressMap.get(badge.key)?.progress ?? 0;
    const currentTier = normalizeBadgeTier(unlocked?.tier, null);
    const nextTier = nextTierForProgress(badge.levels, currentTier, progress);
    const hiddenLocked = Boolean(badge.hidden) && !unlocked;

    return {
      ...badge,
      title: hiddenLocked ? '???' : (unlocked && badge.revealedTitle ? badge.revealedTitle : badge.title),
      unlocked: Boolean(unlocked),
      tier: currentTier,
      unlockedAt: unlocked?.unlockedAt ?? null,
      meta: unlocked?.meta ?? null,
      progress,
      nextTier,
      hiddenLocked,
    };
  });
}

export async function evaluateBadges(userId, options = {}) {
  const source = String(options?.source ?? 'evaluateBadges');
  const context = await buildBadgeContext(userId);
  const progressRows = evaluateCatalogProgress(context);
  const progressMap = new Map(progressRows.map((row) => [row.key, row]));
  const existing = typeof store.listBadgesForUser === 'function'
    ? await store.listBadgesForUser(userId)
    : [];
  const existingByKey = new Map(existing.map((entry) => [entry.badgeKey, entry]));

  const unlocked = [];
  const newlyUnlocked = [];
  const tierUpgrades = [];

  for (const row of progressRows) {
    if (!row.tier) {
      continue;
    }

    const current = existingByKey.get(row.key);
    const payload = {
      source,
      tier: row.tier,
      progress: row.progress,
      evaluatedAt: new Date().toISOString(),
    };

    let stored = null;
    if (!current) {
      stored = await store.unlockBadge(userId, row.key, payload);
      newlyUnlocked.push({
        badgeKey: row.key,
        title: row.badge.hidden ? (row.badge.revealedTitle ?? row.badge.title) : row.badge.title,
        tier: row.tier,
        unlockedAt: stored.unlockedAt,
      });
    } else if (compareTier(row.tier, current.tier) > 0 && typeof store.updateBadgeTier === 'function') {
      stored = await store.updateBadgeTier(userId, row.key, row.tier, payload);
      tierUpgrades.push({
        badgeKey: row.key,
        oldTier: normalizeBadgeTier(current.tier, 'bronze'),
        newTier: row.tier,
      });
    } else {
      stored = await store.unlockBadge(userId, row.key, payload);
    }

    unlocked.push({
      badgeKey: row.key,
      title: row.badge.hidden ? (row.badge.revealedTitle ?? row.badge.title) : row.badge.title,
      tier: normalizeBadgeTier(stored?.tier, row.tier),
      unlockedAt: stored?.unlockedAt ?? null,
      meta: stored?.meta ?? {},
    });
  }

  const persisted = typeof store.listBadgesForUser === 'function'
    ? await store.listBadgesForUser(userId)
    : unlocked;

  return {
    userId,
    badges: persisted.map((entry) => entry.badgeKey),
    catalog: enrichCatalog(persisted, progressMap),
    unlocked,
    newlyUnlocked,
    tierUpgrades,
    total: persisted.length,
    stats: {
      matches: context.matches.length,
      wins: context.wins,
      closeWins: context.closeWins,
      upsets: context.upsets,
      comebacks: context.comebacks,
      goldenPointsWon: context.totalGoldenPointsWon,
      cityChampion: context.cityChampion,
      streaks5: context.streaks5,
      social: context.social,
      bestDuo: context.bestDuo,
    },
  };
}

export async function getBadgeGlobalStats() {
  const users = await store.listUsers();
  const totalUsers = users.length;
  const counts = new Map();

  for (const badge of BADGE_CATALOG) {
    counts.set(badge.key, new Map(BADGE_TIER_ORDER.map((tier) => [tier, 0])));
  }

  for (const user of users) {
    const badges = typeof store.listBadgesForUser === 'function'
      ? await store.listBadgesForUser(user.id)
      : [];
    for (const badge of badges) {
      const key = String(badge?.badgeKey ?? '');
      const tier = normalizeBadgeTier(badge?.tier, null);
      if (!counts.has(key) || !tier) continue;
      const map = counts.get(key);
      map.set(tier, Number(map.get(tier) ?? 0) + 1);
    }
  }

  return {
    totalUsers,
    badges: BADGE_CATALOG.map((badge) => ({
      key: badge.key,
      title: badge.title,
      category: badge.category,
      tiers: BADGE_TIER_ORDER.map((tier) => {
        const count = Number(counts.get(badge.key)?.get(tier) ?? 0);
        const percent = totalUsers > 0 ? Number(((count / totalUsers) * 100).toFixed(2)) : 0;
        return {
          tier,
          count,
          percent,
        };
      }),
    })),
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
