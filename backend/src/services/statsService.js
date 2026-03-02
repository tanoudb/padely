import { store } from '../store/index.js';
import { evaluateBadges } from './gamificationService.js';

const VALID_PERIODS = new Set(['week', 'month', 'season', 'all']);
const HEATMAP_DAYS = 84;

async function matchesForUser(userId) {
  return (await store.listMatchesForUser(userId)).filter((m) => m.status === 'validated');
}

function totalGames(sets) {
  return (sets ?? []).reduce((sum, set) => sum + (Number(set.a) || 0) + (Number(set.b) || 0), 0);
}

function estimateMinutes(match) {
  return Math.round(totalGames(match.sets) * 3.2);
}

function winnerTeam(match) {
  const a = (match.sets ?? []).filter((s) => s.a > s.b).length;
  const b = (match.sets ?? []).filter((s) => s.b > s.a).length;
  return a >= b ? 'A' : 'B';
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function playerWatch(match, userId) {
  const map = match.watchByPlayer ?? {};
  const payload = map[userId] ?? {};
  return {
    distanceKm: Number(payload.distanceKm ?? 0) || 0,
    calories: Number(payload.calories ?? 0) || 0,
    intensityScore: Number(payload.intensityScore ?? 0) || 0,
    heartRateAvg: Number(payload.heartRateAvg ?? 0) || 0,
    oxygenAvg: Number(payload.oxygenAvg ?? 0) || 0,
  };
}

function participantsForMatch(match, teamKey) {
  const fromParticipants = match.participants?.[teamKey];
  if (Array.isArray(fromParticipants) && fromParticipants.length === 2) {
    return fromParticipants;
  }

  return (match[teamKey] ?? []).map((id) => ({
    kind: 'user',
    userId: id,
  }));
}

function participantDisplayName(slot, usersById) {
  if (!slot) return 'Invite';
  if (slot.kind === 'user' && slot.userId) {
    return usersById.get(slot.userId)?.displayName ?? 'Joueur';
  }
  if (slot.kind === 'guest') {
    return slot.guestName ?? 'Invite';
  }
  return 'Invite';
}

async function usersMapFromMatches(matches = []) {
  const ids = new Set();
  for (const match of matches) {
    for (const id of (match.players ?? [])) {
      ids.add(String(id));
    }
  }
  const map = new Map();
  const list = await Promise.all([...ids].map((id) => store.getUserById(id)));
  list.forEach((user) => {
    if (user?.id) {
      map.set(user.id, user);
    }
  });
  return map;
}

function normalizePeriod(raw) {
  const period = String(raw ?? 'all').toLowerCase();
  if (!VALID_PERIODS.has(period)) {
    return 'all';
  }
  return period;
}

function startOfDay(date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function getPeriodStart(period) {
  const now = new Date();
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;

  if (period === 'week') {
    const from = new Date(safeNow);
    from.setDate(from.getDate() - 7);
    return from;
  }

  if (period === 'month') {
    const from = new Date(safeNow);
    from.setDate(from.getDate() - 30);
    return from;
  }

  if (period === 'season') {
    const month = safeNow.getMonth();
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return new Date(safeNow.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
  }

  return null;
}

function matchTimeMs(match) {
  const primary = match.validatedAt ?? match.createdAt;
  const parsed = new Date(primary ?? '').getTime();
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return 0;
}

function filterMatchesByPeriod(matches, period) {
  const periodStart = getPeriodStart(period);
  if (!periodStart) {
    return matches;
  }
  const threshold = periodStart.getTime();
  return matches.filter((match) => matchTimeMs(match) >= threshold);
}

function computeRegularityScore(matches) {
  if (matches.length < 2) {
    return 50;
  }

  const sorted = [...matches].sort((a, b) => matchTimeMs(a) - matchTimeMs(b));
  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gapDays = (matchTimeMs(sorted[i]) - matchTimeMs(sorted[i - 1])) / (1000 * 60 * 60 * 24);
    gaps.push(gapDays);
  }

  const avgGap = average(gaps);
  const score = 100 - Math.min(100, avgGap * 6);
  return Math.round(score);
}

function didUserWin(match, userId) {
  const isTeamA = (match.teamA ?? []).includes(userId);
  const winningTeam = winnerTeam(match);
  return (isTeamA && winningTeam === 'A') || (!isTeamA && winningTeam === 'B');
}

function computeConsistencyScore(matches, userId) {
  if (!matches.length) {
    return 0;
  }

  const performances = matches.map((match) => {
    const isTeamA = (match.teamA ?? []).includes(userId);
    const won = didUserWin(match, userId);

    const gamesFor = (match.sets ?? []).reduce((s, set) => s + (isTeamA ? set.a : set.b), 0);
    const gamesAgainst = (match.sets ?? []).reduce((s, set) => s + (isTeamA ? set.b : set.a), 0);
    const gameDiff = gamesFor - gamesAgainst;

    return (won ? 1 : 0) * 10 + gameDiff;
  });

  const mean = average(performances);
  const variance = average(performances.map((p) => (p - mean) ** 2));
  const stdDev = Math.sqrt(variance);

  const score = 100 - Math.min(100, stdDev * 8);
  return Math.round(score);
}

function findParticipantSnapshot(match, userId) {
  if (!match) {
    return null;
  }
  const teams = [participantsForMatch(match, 'teamA'), participantsForMatch(match, 'teamB')];
  for (const team of teams) {
    const slot = team.find((item) => item.kind === 'user' && item.userId === userId);
    if (slot) {
      return slot;
    }
  }
  return null;
}

function teamStrengthFromParticipants(team = [], fallbackRatings = []) {
  const ratings = [];
  for (const slot of team) {
    if (slot.kind === 'user' && Number.isFinite(Number(slot.rating))) {
      ratings.push(Number(slot.rating));
      continue;
    }
    if (slot.kind === 'guest' && Number.isFinite(Number(slot.guestRating))) {
      ratings.push(Number(slot.guestRating));
    }
  }
  if (!ratings.length) {
    return average(fallbackRatings);
  }
  return average(ratings);
}

function bestSetForUser(match, userId) {
  const isTeamA = (match.teamA ?? []).includes(userId);
  const sets = match.sets ?? [];
  let best = null;
  for (const set of sets) {
    const gamesFor = isTeamA ? Number(set.a ?? 0) : Number(set.b ?? 0);
    const gamesAgainst = isTeamA ? Number(set.b ?? 0) : Number(set.a ?? 0);
    const diff = gamesFor - gamesAgainst;
    if (!best || diff > best.diff || (diff === best.diff && gamesFor > best.gamesFor)) {
      best = {
        score: `${gamesFor}-${gamesAgainst}`,
        diff,
        gamesFor,
      };
    }
  }
  return best;
}

function buildActivityHeatmap(matches, days = HEATMAP_DAYS) {
  const today = startOfDay(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));

  const map = new Map();
  for (const match of matches) {
    const timeMs = matchTimeMs(match);
    if (!timeMs) {
      continue;
    }
    const day = startOfDay(new Date(timeMs));
    if (day < from || day > today) {
      continue;
    }
    const key = day.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const values = [...map.values()];
  const peak = values.length ? Math.max(...values) : 0;
  const items = [];
  for (let index = 0; index < days; index += 1) {
    const day = new Date(from);
    day.setDate(from.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const count = map.get(key) ?? 0;
    let intensity = 0;
    if (peak > 0 && count > 0) {
      intensity = Math.max(1, Math.min(4, Math.ceil((count / peak) * 4)));
    }
    items.push({ day: key, count, intensity });
  }
  return items;
}

function assertPublicAccess(user, viewerId) {
  if (!user) {
    throw new Error('User not found');
  }
  if (!viewerId || viewerId === user.id) {
    return;
  }
  if (user.privacy?.publicProfile === false) {
    throw new Error('Profile is private');
  }
}

function currentSeasonLabel() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `S${quarter} ${now.getFullYear()}`;
}

async function maybeSafeUser(userId, viewerId) {
  const user = await store.getUserById(userId);
  assertPublicAccess(user, viewerId);
  return user;
}

export async function getDashboard(userId, options = {}) {
  const period = normalizePeriod(options.period);
  const user = await maybeSafeUser(userId, options.viewerId ?? userId);

  const allMatches = await matchesForUser(userId);
  const matches = filterMatchesByPeriod(allMatches, period);
  const minutes = matches.reduce((sum, m) => sum + estimateMinutes(m), 0);

  const wins = matches.filter((m) => didUserWin(m, userId)).length;
  const losses = matches.length - wins;
  const watches = matches.map((match) => playerWatch(match, userId));
  const totalDistanceKm = Number(watches.reduce((sum, w) => sum + w.distanceKm, 0).toFixed(2));
  const averageDistanceKm = Number((matches.length ? totalDistanceKm / matches.length : 0).toFixed(2));
  const calories = Math.round(watches.reduce((sum, w) => sum + w.calories, 0));
  const averageHeartRate = Math.round(average(watches.filter((w) => w.heartRateAvg > 0).map((w) => w.heartRateAvg)));
  const averageOxygen = Math.round(average(watches.filter((w) => w.oxygenAvg > 0).map((w) => w.oxygenAvg)));

  return {
    userId,
    period,
    seasonLabel: currentSeasonLabel(),
    rating: user.rating,
    pir: user.pir,
    matches: matches.length,
    wins,
    losses,
    playTimeMinutes: minutes,
    calories,
    totalDistanceKm,
    averageDistanceKm,
    averageHeartRate,
    averageOxygen,
    consistencyScore: computeConsistencyScore(matches, userId),
    regularityScore: computeRegularityScore(matches),
    progression: user.history ?? [],
    activityHeatmap: buildActivityHeatmap(matches),
  };
}

export async function getDuoStats(userId, options = {}) {
  await maybeSafeUser(userId, options.viewerId ?? userId);

  const period = normalizePeriod(options.period);
  const matches = filterMatchesByPeriod(await matchesForUser(userId), period);
  const duoMap = new Map();

  for (const match of matches) {
    const teamA = participantsForMatch(match, 'teamA');
    const teamB = participantsForMatch(match, 'teamB');
    const userInTeamA = teamA.some((slot) => slot.kind === 'user' && slot.userId === userId);
    const team = userInTeamA ? teamA : teamB;
    const partner = team.find((slot) => slot.kind === 'user' && slot.userId !== userId);
    if (!partner?.userId) {
      continue;
    }

    const won = didUserWin(match, userId);

    if (!duoMap.has(partner.userId)) {
      duoMap.set(partner.userId, {
        partnerId: partner.userId,
        matches: 0,
        wins: 0,
        totalDistanceKm: 0,
      });
    }

    const item = duoMap.get(partner.userId);
    item.matches += 1;
    item.wins += won ? 1 : 0;
    item.totalDistanceKm += playerWatch(match, userId).distanceKm;
  }

  return [...duoMap.values()].map((item) => ({
    ...item,
    winRate: item.matches ? Number(((item.wins / item.matches) * 100).toFixed(1)) : 0,
    averageDistanceKm: item.matches ? Number((item.totalDistanceKm / item.matches).toFixed(2)) : 0,
    totalDistanceKm: Number(item.totalDistanceKm.toFixed(2)),
  }));
}

export async function getHeadToHead(userId, opponentId, options = {}) {
  const viewerId = options.viewerId ?? userId;
  await maybeSafeUser(userId, viewerId);
  await maybeSafeUser(opponentId, viewerId);

  const period = normalizePeriod(options.period);
  const base = await matchesForUser(userId);
  const filteredByOpponent = base.filter((match) => (match.teamA ?? []).includes(opponentId) || (match.teamB ?? []).includes(opponentId));
  const matches = filterMatchesByPeriod(filteredByOpponent, period)
    .sort((a, b) => matchTimeMs(b) - matchTimeMs(a));

  const wins = matches.filter((match) => didUserWin(match, userId)).length;
  const losses = matches.length - wins;

  return {
    userId,
    opponentId,
    period,
    totalMatches: matches.length,
    wins,
    losses,
    winRate: matches.length ? Number(((wins / matches.length) * 100).toFixed(1)) : 0,
    averageMatchMinutes: matches.length ? Math.round(average(matches.map((match) => estimateMinutes(match)))) : 0,
    lastPlayedAt: matches[0]?.validatedAt ?? matches[0]?.createdAt ?? null,
    recent: matches.slice(0, 8).map((match) => ({
      matchId: match.id,
      createdAt: match.createdAt,
      validatedAt: match.validatedAt ?? null,
      score: (match.sets ?? []).map((set) => `${set.a}-${set.b}`).join(' | '),
      won: didUserWin(match, userId),
    })),
  };
}

export async function getRecords(userId, options = {}) {
  const viewerId = options.viewerId ?? userId;
  const user = await maybeSafeUser(userId, viewerId);
  const period = normalizePeriod(options.period);
  const matches = filterMatchesByPeriod(await matchesForUser(userId), period)
    .sort((a, b) => matchTimeMs(a) - matchTimeMs(b));

  let bestUpset = null;
  let bestSet = null;
  let bestWinStreak = 0;
  let currentWinStreak = 0;

  for (const match of matches) {
    const userWon = didUserWin(match, userId);
    if (userWon) {
      currentWinStreak += 1;
      bestWinStreak = Math.max(bestWinStreak, currentWinStreak);
    } else {
      currentWinStreak = 0;
    }

    const teamASlots = participantsForMatch(match, 'teamA');
    const teamBSlots = participantsForMatch(match, 'teamB');
    const isTeamA = (match.teamA ?? []).includes(userId);
    const myTeam = isTeamA ? teamASlots : teamBSlots;
    const oppTeam = isTeamA ? teamBSlots : teamASlots;

    const myStrength = teamStrengthFromParticipants(myTeam, [Number(user.rating ?? 1200)]);
    const oppStrength = teamStrengthFromParticipants(oppTeam, [1200, 1200]);
    const gap = Number((oppStrength - myStrength).toFixed(1));

    if (userWon && (!bestUpset || gap > bestUpset.ratingGap)) {
      bestUpset = {
        matchId: match.id,
        ratingGap: gap,
        at: match.validatedAt ?? match.createdAt,
      };
    }

    const bestSetInMatch = bestSetForUser(match, userId);
    if (bestSetInMatch && (!bestSet || bestSetInMatch.diff > bestSet.diff)) {
      bestSet = {
        matchId: match.id,
        score: bestSetInMatch.score,
        diff: bestSetInMatch.diff,
        at: match.validatedAt ?? match.createdAt,
      };
    }
  }

  const longestMatch = matches
    .map((match) => ({
      matchId: match.id,
      minutes: estimateMinutes(match),
      at: match.validatedAt ?? match.createdAt,
    }))
    .sort((a, b) => b.minutes - a.minutes)[0] ?? null;

  const participant = findParticipantSnapshot(
    [...matches].sort((a, b) => matchTimeMs(b) - matchTimeMs(a))[0] ?? null,
    userId,
  );

  return {
    userId,
    period,
    seasonLabel: currentSeasonLabel(),
    profile: {
      id: user.id,
      displayName: user.displayName,
      arcadeTag: user.arcadeTag,
      city: user.city,
      rating: user.rating,
      pir: user.pir,
    },
    records: {
      biggestUpset: bestUpset,
      bestWinStreak,
      bestSet,
      longestMatch,
      totalValidatedMatches: matches.length,
    },
    activityHeatmap: buildActivityHeatmap(matches),
    recentForm: matches.slice(-10).map((match) => ({
      matchId: match.id,
      won: didUserWin(match, userId),
      at: match.validatedAt ?? match.createdAt,
    })),
    playerSnapshot: participant,
  };
}

function sanitizeRecentMatchesVisibility(user, matches) {
  const showGuestMatches = Boolean(user?.privacy?.showGuestMatches ?? false);
  if (showGuestMatches) {
    return matches;
  }
  return matches.filter((match) => {
    const teamA = participantsForMatch(match, 'teamA');
    const teamB = participantsForMatch(match, 'teamB');
    return [...teamA, ...teamB].every((slot) => slot.kind === 'user');
  });
}

function matchSummaryForViewer(match, playerId, usersById) {
  const isTeamA = (match.teamA ?? []).includes(playerId);
  const myTeamKey = isTeamA ? 'teamA' : 'teamB';
  const oppTeamKey = isTeamA ? 'teamB' : 'teamA';
  const myTeam = participantsForMatch(match, myTeamKey);
  const oppTeam = participantsForMatch(match, oppTeamKey);
  const partner = myTeam.find((slot) => slot.kind === 'user' && slot.userId !== playerId) ?? myTeam.find((slot) => slot.kind === 'guest');

  const outcome = didUserWin(match, playerId) ? 'win' : 'loss';
  return {
    matchId: match.id,
    mode: match.mode ?? 'ranked',
    outcome,
    createdAt: match.createdAt,
    validatedAt: match.validatedAt ?? null,
    score: (match.sets ?? []).map((set) => `${set.a}-${set.b}`).join(' / '),
    partner: participantDisplayName(partner, usersById),
    opponents: oppTeam.map((slot) => participantDisplayName(slot, usersById)),
  };
}

export async function getPublicPlayerProfile(playerId, options = {}) {
  const viewerId = options.viewerId ?? playerId;
  const period = normalizePeriod(options.period);
  const user = await maybeSafeUser(playerId, viewerId);

  const baseMatches = await matchesForUser(playerId);
  const visibilityMatches = sanitizeRecentMatchesVisibility(user, baseMatches);
  const usersById = await usersMapFromMatches(visibilityMatches);
  const recentMatches = filterMatchesByPeriod(visibilityMatches, period)
    .sort((a, b) => matchTimeMs(b) - matchTimeMs(a))
    .slice(0, 12)
    .map((match) => matchSummaryForViewer(match, playerId, usersById));

  const [dashboard, records, badges] = await Promise.all([
    getDashboard(playerId, { viewerId, period }),
    getRecords(playerId, { viewerId, period }),
    evaluateBadges(playerId),
  ]);

  const headToHead = viewerId && viewerId !== playerId
    ? await getHeadToHead(viewerId, playerId, { viewerId, period })
    : null;

  return {
    profile: records.profile,
    period,
    seasonLabel: records.seasonLabel,
    stats: {
      matches: dashboard.matches,
      wins: dashboard.wins,
      losses: dashboard.losses,
      winRate: dashboard.matches ? Number(((dashboard.wins / dashboard.matches) * 100).toFixed(1)) : 0,
      playTimeMinutes: dashboard.playTimeMinutes,
      consistencyScore: dashboard.consistencyScore,
      regularityScore: dashboard.regularityScore,
      averageDistanceKm: dashboard.averageDistanceKm,
    },
    records: records.records,
    activityHeatmap: records.activityHeatmap,
    badges: badges.badges ?? [],
    headToHead,
    recentMatches,
  };
}

export async function getPerformanceHoles(userId, options = {}) {
  await maybeSafeUser(userId, options.viewerId ?? userId);

  const period = normalizePeriod(options.period);
  const matches = filterMatchesByPeriod(await matchesForUser(userId), period);
  const fatigueDrop = Math.min(40, matches.length * 3);
  const clues = [];

  if (fatigueDrop >= 18) {
    clues.push(`Baisse estimee de ${fatigueDrop}% d'efficacite apres 1h de jeu`);
  }
  if (matches.length >= 5) {
    clues.push('Tendance a reculer en fin de set: travailler les montees a la volee');
  }

  const recommendations = [
    'Drill endurance: 4 blocs de 6 minutes haute intensite / 2 minutes repos',
    'Routine volee: 3 series de 25 volees croisees sous contrainte de temps',
    'Mental clutch: scenario punto de oro a l entrainement 10 repetitions',
  ];

  return {
    userId,
    period,
    findings: clues,
    recommendations,
  };
}
