import { store } from '../store/index.js';
import { evaluateBadges } from './gamificationService.js';

const VALID_PERIODS = new Set(['week', 'month', 'season', 'all']);
const HEATMAP_DAYS = 84;
const DAY_MS = 86_400_000;

const RHYTHM_RULES = {
  light: {
    key: 'light',
    windowDays: 30,
    targetActivities: 1,
    returnThresholdDays: 35,
    notificationCapWeekly: 1,
  },
  regular: {
    key: 'regular',
    windowDays: 10,
    targetActivities: 1,
    returnThresholdDays: 16,
    notificationCapWeekly: 2,
  },
  intense: {
    key: 'intense',
    windowDays: 7,
    targetActivities: 2,
    returnThresholdDays: 10,
    notificationCapWeekly: 3,
  },
};

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function uniqueActivityDays(matches = []) {
  return new Set(matches
    .map((match) => {
      const ms = matchTimeMs(match);
      if (!ms) return '';
      return startOfDay(new Date(ms)).toISOString().slice(0, 10);
    })
    .filter(Boolean)).size;
}

function getPlayerRhythm(user) {
  const raw = String(user?.settings?.playerRhythm ?? '').toLowerCase();
  if (raw === 'light' || raw === 'regular' || raw === 'intense') {
    return raw;
  }
  return 'regular';
}

function matchesInLastDays(matches = [], days = 30) {
  const threshold = Date.now() - days * DAY_MS;
  return matches.filter((match) => matchTimeMs(match) >= threshold);
}

function computePlayerProfileType({ recent30 = [], recent90 = [] }) {
  const matches30 = recent30.length;
  const matches90 = recent90.length;
  const rankedShare = matches30
    ? recent30.filter((match) => String(match.mode ?? '').toLowerCase() === 'ranked').length / matches30
    : 0;

  if (matches30 <= 1 && matches90 <= 4) {
    return 'chill';
  }
  if (matches30 >= 8 || (matches30 >= 4 && rankedShare >= 0.65)) {
    return 'competitor';
  }
  return 'regular';
}

function computeFrequencyScore(activitiesInWindow, rhythm) {
  return clamp(Math.round((activitiesInWindow / rhythm.targetActivities) * 100), 0, 100);
}

function computeResultScore(matches, userId) {
  const recent = [...matches]
    .sort((a, b) => matchTimeMs(b) - matchTimeMs(a))
    .slice(0, 8);
  if (!recent.length) {
    return 40;
  }
  const wins = recent.filter((match) => didUserWin(match, userId)).length;
  const winRate = wins / recent.length;
  return clamp(Math.round(20 + winRate * 80), 0, 100);
}

function computeProgressScore(user, consistencyScore) {
  const history = Array.isArray(user?.history) ? user.history : [];
  if (history.length < 2) {
    return clamp(Math.round(45 + (consistencyScore - 50) * 0.25), 0, 100);
  }
  const recent = history.slice(-8);
  const ratingDelta = recent.reduce((sum, item) => sum + Number(item?.delta ?? 0), 0);
  const boundedMomentum = clamp(ratingDelta, -80, 80);
  const base = 50 + boundedMomentum * 0.45 + (consistencyScore - 50) * 0.35;
  return clamp(Math.round(base), 0, 100);
}

function computeFormData({ user, allMatches, userId, consistencyScore, rhythmKey }) {
  const rhythm = RHYTHM_RULES[rhythmKey] ?? RHYTHM_RULES.regular;
  const windowMatches = matchesInLastDays(allMatches, rhythm.windowDays);
  const activitiesInWindow = uniqueActivityDays(windowMatches);
  const frequencyScore = computeFrequencyScore(activitiesInWindow, rhythm);
  const resultsScore = computeResultScore(allMatches, userId);
  const progressScore = computeProgressScore(user, consistencyScore);
  const score = clamp(
    Math.round(frequencyScore * 0.5 + resultsScore * 0.3 + progressScore * 0.2),
    0,
    100,
  );

  return {
    score,
    frequencyScore,
    resultsScore,
    progressScore,
    activitiesInWindow,
    targetActivities: rhythm.targetActivities,
    windowDays: rhythm.windowDays,
  };
}

function computeSmartStreak(allMatches, rhythmKey) {
  const rhythm = RHYTHM_RULES[rhythmKey] ?? RHYTHM_RULES.regular;
  const sorted = [...allMatches].sort((a, b) => matchTimeMs(b) - matchTimeMs(a));
  const latestMs = sorted.length ? matchTimeMs(sorted[0]) : 0;
  const lastActivityAt = latestMs ? new Date(latestMs).toISOString() : null;
  const daysSinceLastActivity = latestMs ? Math.floor((Date.now() - latestMs) / DAY_MS) : null;

  if (!sorted.length) {
    return {
      count: 0,
      unit: rhythm.windowDays >= 28 ? 'month' : (rhythm.windowDays <= 7 ? 'week' : 'window'),
      windowDays: rhythm.windowDays,
      targetActivities: rhythm.targetActivities,
      lastActivityAt,
      daysSinceLastActivity,
    };
  }

  const activityDays = new Set(sorted
    .map((match) => startOfDay(new Date(matchTimeMs(match))).getTime()));

  let count = 0;
  let cursorEnd = startOfDay(new Date());
  while (count < 18) {
    const windowStart = new Date(cursorEnd);
    windowStart.setDate(windowStart.getDate() - (rhythm.windowDays - 1));
    let windowActivities = 0;

    for (const dayMs of activityDays) {
      if (dayMs >= windowStart.getTime() && dayMs <= cursorEnd.getTime()) {
        windowActivities += 1;
      }
    }

    if (windowActivities >= rhythm.targetActivities) {
      count += 1;
      cursorEnd = new Date(windowStart);
      cursorEnd.setDate(cursorEnd.getDate() - 1);
      continue;
    }
    break;
  }

  return {
    count,
    unit: rhythm.windowDays >= 28 ? 'month' : (rhythm.windowDays <= 7 ? 'week' : 'window'),
    windowDays: rhythm.windowDays,
    targetActivities: rhythm.targetActivities,
    lastActivityAt,
    daysSinceLastActivity,
  };
}

function buildReturnMode({ smartStreak, rhythmKey }) {
  const rhythm = RHYTHM_RULES[rhythmKey] ?? RHYTHM_RULES.regular;
  const pauseDays = Number(smartStreak?.daysSinceLastActivity);
  if (!Number.isFinite(pauseDays)) {
    return {
      active: false,
      pauseDays: 0,
      bonusForm: 0,
      reason: 'new_player',
    };
  }

  const active = pauseDays >= rhythm.returnThresholdDays;
  if (!active) {
    return {
      active: false,
      pauseDays,
      bonusForm: 0,
      reason: 'active_cycle',
    };
  }

  return {
    active: true,
    pauseDays,
    bonusForm: clamp(Math.round(pauseDays / 7), 2, 12),
    reason: 'long_break',
  };
}

function buildAdaptiveObjective({ form, rhythmKey, returnMode }) {
  const rhythm = RHYTHM_RULES[rhythmKey] ?? RHYTHM_RULES.regular;
  const remainingActivities = Math.max(0, rhythm.targetActivities - Number(form.activitiesInWindow ?? 0));

  if (returnMode.active) {
    return {
      mode: 'return',
      remainingActivities,
      targetActivities: rhythm.targetActivities,
      windowDays: rhythm.windowDays,
    };
  }

  if (remainingActivities > 0) {
    return {
      mode: 'chase',
      remainingActivities,
      targetActivities: rhythm.targetActivities,
      windowDays: rhythm.windowDays,
    };
  }

  return {
    mode: 'maintain',
    remainingActivities: 0,
    targetActivities: rhythm.targetActivities,
    windowDays: rhythm.windowDays,
  };
}

function computeNarrativePhase(allMatches, user) {
  const totalMatches = allMatches.length;
  const recent = [...allMatches].sort((a, b) => matchTimeMs(b) - matchTimeMs(a)).slice(0, 8);
  const recentWins = recent.filter((match) => didUserWin(match, user.id)).length;
  const winRate = recent.length ? recentWins / recent.length : 0;
  const recentDelta = (Array.isArray(user.history) ? user.history : [])
    .slice(-8)
    .reduce((sum, entry) => sum + Number(entry?.delta ?? 0), 0);

  if (totalMatches < 3) return 'debuts';
  if (totalMatches < 8) return 'apprentissage';
  if (recentDelta >= 40 && winRate >= 0.55) return 'declic';
  if (winRate >= 0.65 && totalMatches >= 12) return 'confirmation';
  if (winRate < 0.45 && totalMatches >= 8) return 'stagnation';
  return 'nouveau_cap';
}

function buildLatestMatchInsight(match, user, returnMode) {
  if (!match) {
    return null;
  }

  const isTeamA = (match.teamA ?? []).includes(user.id);
  const myTeam = participantsForMatch(match, isTeamA ? 'teamA' : 'teamB');
  const oppTeam = participantsForMatch(match, isTeamA ? 'teamB' : 'teamA');
  const sets = match.sets ?? [];

  const setDiffs = sets.map((set) => Math.abs(Number(set.a ?? 0) - Number(set.b ?? 0)));
  const avgSetDiff = setDiffs.length ? average(setDiffs) : 4;
  const closeness = clamp(Math.round(100 - avgSetDiff * 18), 0, 100);
  const myStrength = teamStrengthFromParticipants(myTeam, [Number(user.rating ?? 1200), Number(user.rating ?? 1200)]);
  const oppStrength = teamStrengthFromParticipants(oppTeam, [1200, 1200]);
  const proximity = clamp(Math.round(100 - Math.abs(oppStrength - myStrength) / 3), 0, 100);
  const tieBreakLike = sets.some((set) => Math.abs(Number(set.a ?? 0) - Number(set.b ?? 0)) === 1);
  const importanceScore = clamp(
    Math.round(closeness * 0.55 + proximity * 0.35 + (tieBreakLike ? 10 : 0)),
    0,
    100,
  );

  let importanceLabel = 'normal';
  if (importanceScore >= 80) importanceLabel = 'key';
  else if (importanceScore >= 60) importanceLabel = 'high';
  else if (importanceScore < 35) importanceLabel = 'low';

  let stressLabel = 'controlled';
  if (closeness <= 35) stressLabel = 'easy';
  else if (closeness >= 78 && (tieBreakLike || sets.length >= 3)) stressLabel = 'combat';
  else if (closeness >= 60) stressLabel = 'chaos';

  const didWin = didUserWin(match, user.id);
  const myFirstSet = sets[0]
    ? (isTeamA ? Number(sets[0].a ?? 0) : Number(sets[0].b ?? 0))
    : 0;
  const oppFirstSet = sets[0]
    ? (isTeamA ? Number(sets[0].b ?? 0) : Number(sets[0].a ?? 0))
    : 0;
  const lostFirstSet = sets.length > 0 && myFirstSet < oppFirstSet;

  const momentTags = [];
  if (didWin && lostFirstSet) momentTags.push('remontada');
  if (tieBreakLike) momentTags.push('match_serre');
  if (Number(match.goldenPoints?.teamA ?? 0) + Number(match.goldenPoints?.teamB ?? 0) > 0) {
    momentTags.push('golden_point');
  }
  if (returnMode?.active) momentTags.push('comeback');

  return {
    matchId: match.id,
    importanceScore,
    importanceLabel,
    stressLabel,
    momentTags: momentTags.slice(0, 3),
    didWin,
    score: sets.map((set) => `${set.a}-${set.b}`).join(' / '),
  };
}

function computeBestPartner(matches, userId) {
  const map = new Map();
  for (const match of matches) {
    const teamA = participantsForMatch(match, 'teamA');
    const teamB = participantsForMatch(match, 'teamB');
    const myTeam = teamA.some((slot) => slot.kind === 'user' && slot.userId === userId) ? teamA : teamB;
    const partner = myTeam.find((slot) => slot.kind === 'user' && slot.userId !== userId);
    if (!partner?.userId) continue;
    const key = partner.userId;
    if (!map.has(key)) {
      map.set(key, { partnerId: key, matches: 0, wins: 0 });
    }
    const entry = map.get(key);
    entry.matches += 1;
    if (didUserWin(match, userId)) {
      entry.wins += 1;
    }
  }

  const rows = [...map.values()].map((item) => ({
    ...item,
    winRate: item.matches ? Number(((item.wins / item.matches) * 100).toFixed(1)) : 0,
  }));

  if (!rows.length) return null;
  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });
  return rows[0];
}

function computeRivalryNarrative(matches, userId, usersById) {
  const opponentMap = new Map();
  for (const match of matches) {
    const isTeamA = (match.teamA ?? []).includes(userId);
    const opponents = participantsForMatch(match, isTeamA ? 'teamB' : 'teamA')
      .filter((slot) => slot.kind === 'user' && slot.userId);
    for (const opp of opponents) {
      if (!opponentMap.has(opp.userId)) {
        opponentMap.set(opp.userId, { opponentId: opp.userId, matches: 0, wins: 0, losses: 0 });
      }
      const row = opponentMap.get(opp.userId);
      row.matches += 1;
      if (didUserWin(match, userId)) row.wins += 1;
      else row.losses += 1;
    }
  }

  const rivalries = [...opponentMap.values()].sort((a, b) => b.matches - a.matches);
  const top = rivalries[0] ?? null;
  if (!top) return null;

  return {
    ...top,
    opponentName: usersById.get(top.opponentId)?.displayName ?? 'Adversaire',
    unbeatenByUser: top.wins === 0 && top.matches >= 2,
  };
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
  const recent30 = matchesInLastDays(allMatches, 30);
  const recent90 = matchesInLastDays(allMatches, 90);
  const rhythmKey = getPlayerRhythm(user);
  const rhythm = RHYTHM_RULES[rhythmKey] ?? RHYTHM_RULES.regular;
  const minutes = matches.reduce((sum, m) => sum + estimateMinutes(m), 0);

  const wins = matches.filter((m) => didUserWin(m, userId)).length;
  const losses = matches.length - wins;
  const watches = matches.map((match) => playerWatch(match, userId));
  const totalDistanceKm = Number(watches.reduce((sum, w) => sum + w.distanceKm, 0).toFixed(2));
  const averageDistanceKm = Number((matches.length ? totalDistanceKm / matches.length : 0).toFixed(2));
  const calories = Math.round(watches.reduce((sum, w) => sum + w.calories, 0));
  const averageHeartRate = Math.round(average(watches.filter((w) => w.heartRateAvg > 0).map((w) => w.heartRateAvg)));
  const averageOxygen = Math.round(average(watches.filter((w) => w.oxygenAvg > 0).map((w) => w.oxygenAvg)));

  const consistencyScore = computeConsistencyScore(matches, userId);
  const regularityScore = computeRegularityScore(matches);
  const form = computeFormData({
    user,
    allMatches,
    userId,
    consistencyScore,
    rhythmKey,
  });
  const smartStreak = computeSmartStreak(allMatches, rhythmKey);
  const returnMode = buildReturnMode({ smartStreak, rhythmKey });
  const usersById = await usersMapFromMatches(allMatches);
  const recentValidated = [...allMatches].sort((a, b) => matchTimeMs(b) - matchTimeMs(a));
  const latestMatch = recentValidated[0] ?? null;
  const latestMatchInsight = buildLatestMatchInsight(latestMatch, user, returnMode);
  const bestPartner = computeBestPartner(allMatches, userId);
  const rivalry = computeRivalryNarrative(allMatches, userId, usersById);
  const narrativePhase = computeNarrativePhase(allMatches, user);
  const playerProfileType = computePlayerProfileType({
    recent30,
    recent90,
  });
  const adaptiveObjective = buildAdaptiveObjective({
    form,
    rhythmKey,
    returnMode,
  });

  return {
    userId,
    period,
    seasonLabel: currentSeasonLabel(),
    rating: user.rating,
    pir: user.pir,
    playerRhythm: rhythmKey,
    rhythm: {
      ...rhythm,
    },
    playerProfileType,
    form,
    smartStreak,
    returnMode,
    adaptiveObjective,
    narrativePhase,
    latestMatchInsight,
    bestPartner,
    rivalry,
    matches: matches.length,
    wins,
    losses,
    playTimeMinutes: minutes,
    calories,
    totalDistanceKm,
    averageDistanceKm,
    averageHeartRate,
    averageOxygen,
    consistencyScore,
    regularityScore,
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

  const rows = [...duoMap.values()].map((item) => ({
    ...item,
    winRate: item.matches ? Number(((item.wins / item.matches) * 100).toFixed(1)) : 0,
    averageDistanceKm: item.matches ? Number((item.totalDistanceKm / item.matches).toFixed(2)) : 0,
    totalDistanceKm: Number(item.totalDistanceKm.toFixed(2)),
  }));

  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });

  const bestDuo = rows.find((entry) => entry.matches >= 3) ?? null;
  if (!bestDuo) {
    return {
      rows,
      bestDuo: null,
    };
  }

  const users = await store.listUsers();
  const names = new Map(users.map((user) => [user.id, user.displayName]));
  const partnerName = names.get(bestDuo.partnerId) ?? bestDuo.partnerId;
  const daysSinceLast = bestDuo.lastMatchAt
    ? Math.floor((Date.now() - new Date(bestDuo.lastMatchAt).getTime()) / DAY_MS)
    : null;

  return {
    rows,
    bestDuo: {
      ...bestDuo,
      partnerName,
      message: `Ton meilleur duo : ${partnerName} (+${Math.round(bestDuo.winRate)}% winrate)`,
      suggestion: Number.isFinite(daysSinceLast) && daysSinceLast > 14 ? 'Vous devriez rejouer' : null,
      daysSinceLast,
    },
  };
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
