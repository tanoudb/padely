import { computeFormIndex } from '../domain/pir.js';
import { store } from '../store/index.js';

const DAY_MS = 86_400_000;

const PROFILE_TYPES = new Set(['chill', 'regular', 'competitor']);
const PERSONALITIES = new Set(['strategist', 'warrior', 'regular', 'unpredictable', 'clutch']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function matchTimeMs(match) {
  const raw = match?.validatedAt ?? match?.createdAt;
  const ms = new Date(raw ?? 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function didUserWin(match, userId) {
  const sets = safeArray(match?.sets);
  const teamASets = sets.filter((set) => Number(set?.a ?? 0) > Number(set?.b ?? 0)).length;
  const teamBSets = sets.filter((set) => Number(set?.b ?? 0) > Number(set?.a ?? 0)).length;
  const inTeamA = safeArray(match?.teamA).includes(userId);
  const winner = teamASets >= teamBSets ? 'A' : 'B';
  return (inTeamA && winner === 'A') || (!inTeamA && winner === 'B');
}

function participantsForTeam(match, teamKey) {
  const fromParticipants = match?.participants?.[teamKey];
  if (Array.isArray(fromParticipants) && fromParticipants.length) {
    return fromParticipants;
  }
  return safeArray(match?.[teamKey]).map((userId) => ({
    kind: 'user',
    userId,
  }));
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function teamStrengthFromMatch(match, teamKey, usersById) {
  const snapshots = safeArray(match?.usersSnapshot?.[teamKey]);
  const fromSnapshot = snapshots
    .map((entry) => Number(entry?.rating ?? entry?.guestRating))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (fromSnapshot.length) {
    return average(fromSnapshot);
  }

  const participants = participantsForTeam(match, teamKey);
  const fromParticipants = participants
    .map((slot) => {
      if (slot?.kind === 'guest') {
        return Number(slot?.guestRating ?? 0);
      }
      const user = usersById.get(slot?.userId);
      return Number(user?.rating ?? 0);
    })
    .filter((value) => Number.isFinite(value) && value > 0);
  return average(fromParticipants);
}

function gamesMarginForUser(match, userId) {
  const isTeamA = safeArray(match?.teamA).includes(userId);
  const sets = safeArray(match?.sets);
  const delta = sets.reduce((sum, set) => {
    const a = Number(set?.a ?? 0);
    const b = Number(set?.b ?? 0);
    return sum + (isTeamA ? (a - b) : (b - a));
  }, 0);
  return delta;
}

function activityStreak(matches = []) {
  const dayKeys = [...new Set(matches
    .map((match) => {
      const ms = matchTimeMs(match);
      if (!ms) return '';
      return new Date(ms).toISOString().slice(0, 10);
    })
    .filter(Boolean))]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (!dayKeys.length) {
    return {
      count: 0,
      unit: 'day',
      lastActivityAt: null,
    };
  }

  let count = 1;
  for (let index = 1; index < dayKeys.length; index += 1) {
    const prev = new Date(`${dayKeys[index - 1]}T00:00:00.000Z`).getTime();
    const current = new Date(`${dayKeys[index]}T00:00:00.000Z`).getTime();
    const diffDays = Math.round((prev - current) / DAY_MS);
    if (diffDays === 1) {
      count += 1;
      continue;
    }
    break;
  }

  return {
    count,
    unit: 'day',
    lastActivityAt: new Date(`${dayKeys[0]}T12:00:00.000Z`).toISOString(),
  };
}

function inferProfileType({ recent90Matches, daysSinceLastMatch, hasTournament, winStreak }) {
  const avgMonthly = recent90Matches.length / 3;
  if (daysSinceLastMatch >= 30 || avgMonthly <= 1) {
    return 'chill';
  }
  if (avgMonthly >= 9 || hasTournament || winStreak >= 5) {
    return 'competitor';
  }
  if (avgMonthly >= 2 && avgMonthly <= 8) {
    return 'regular';
  }
  return avgMonthly > 8 ? 'competitor' : 'chill';
}

function inferPersonality({ recentMatches, userId, usersById }) {
  if (!recentMatches.length) {
    return 'regular';
  }

  let upsetWins = 0;
  let wins = 0;
  let closeWins = 0;
  let clutchWon = 0;
  let clutchTotal = 0;
  let weakLosses = 0;
  let strongestUpset = 0;
  const margins = [];

  for (const match of recentMatches) {
    const won = didUserWin(match, userId);
    const myTeamKey = safeArray(match?.teamA).includes(userId) ? 'teamA' : 'teamB';
    const oppTeamKey = myTeamKey === 'teamA' ? 'teamB' : 'teamA';
    const myStrength = teamStrengthFromMatch(match, myTeamKey, usersById);
    const oppStrength = teamStrengthFromMatch(match, oppTeamKey, usersById);
    const gap = oppStrength - myStrength;
    const margin = Math.abs(gamesMarginForUser(match, userId));
    margins.push(margin);

    if (won) {
      wins += 1;
      if (gap >= 100) {
        upsetWins += 1;
        strongestUpset = Math.max(strongestUpset, gap);
      }
      if (margin <= 3) {
        closeWins += 1;
      }
    } else if (gap <= -120) {
      weakLosses += 1;
    }

    const golden = match?.goldenPoints ?? {};
    const myGolden = myTeamKey === 'teamA' ? Number(golden?.teamA ?? 0) : Number(golden?.teamB ?? 0);
    const totalGolden = Number(golden?.teamA ?? 0) + Number(golden?.teamB ?? 0);
    clutchWon += myGolden;
    clutchTotal += totalGolden;
  }

  const upsetRatio = wins ? upsetWins / wins : 0;
  const closeWinRatio = wins ? closeWins / wins : 0;
  const clutchRatio = clutchTotal > 0 ? clutchWon / clutchTotal : 0;
  const averageMargin = average(margins);
  const variance = margins.length
    ? average(margins.map((value) => (value - averageMargin) ** 2))
    : 0;

  if (clutchRatio >= 0.62 && clutchTotal >= 8) {
    return 'clutch';
  }
  if (upsetRatio >= 0.35 || strongestUpset >= 180) {
    return 'strategist';
  }
  if (closeWinRatio >= 0.45 && wins >= 4) {
    return 'warrior';
  }
  if (variance >= 7 && upsetWins >= 2 && weakLosses >= 2) {
    return 'unpredictable';
  }
  return 'regular';
}

function computeWinStreak(history = []) {
  if (!Array.isArray(history) || !history.length) {
    return 0;
  }

  let streak = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const row = history[index] ?? {};
    const didWin = typeof row.didWin === 'boolean' ? row.didWin : Number(row.delta ?? 0) > 0;
    if (!didWin) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function computeObjective(profileType, currentMatches30) {
  if (profileType === 'competitor') {
    return {
      type: 'volume',
      target: 9,
      current: currentMatches30,
      deadline: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    };
  }
  if (profileType === 'regular') {
    return {
      type: 'consistency',
      target: 4,
      current: currentMatches30,
      deadline: new Date(Date.now() + 30 * DAY_MS).toISOString(),
    };
  }
  return {
    type: 'comeback',
    target: 2,
    current: currentMatches30,
    deadline: new Date(Date.now() + 45 * DAY_MS).toISOString(),
  };
}

function computeRivalries(matches, userId) {
  const map = new Map();
  for (const match of matches) {
    const isTeamA = safeArray(match?.teamA).includes(userId);
    const opponents = participantsForTeam(match, isTeamA ? 'teamB' : 'teamA')
      .filter((slot) => slot?.kind === 'user' && slot?.userId);

    for (const opponent of opponents) {
      if (!map.has(opponent.userId)) {
        map.set(opponent.userId, {
          opponentId: opponent.userId,
          wins: 0,
          losses: 0,
          matches: 0,
          lastMatchAt: null,
        });
      }
      const row = map.get(opponent.userId);
      const won = didUserWin(match, userId);
      row.matches += 1;
      row.wins += won ? 1 : 0;
      row.losses += won ? 0 : 1;
      const when = match?.validatedAt ?? match?.createdAt ?? null;
      if (when && (!row.lastMatchAt || new Date(when).getTime() > new Date(row.lastMatchAt).getTime())) {
        row.lastMatchAt = when;
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      return new Date(b.lastMatchAt ?? 0).getTime() - new Date(a.lastMatchAt ?? 0).getTime();
    })
    .slice(0, 5);
}

function computeFormScore({ recent30Matches, history, streakCount }) {
  const frequencyScore = clamp(Math.round((recent30Matches.length / 8) * 100), 0, 100);
  const formIndex = computeFormIndex(history, 10);
  const resultScore = clamp(Math.round((formIndex + 1) * 50), 0, 100);
  const streakScore = clamp(Math.round(streakCount * 14), 0, 100);
  const now = Date.now();
  const recentHistory = safeArray(history).filter((entry) => {
    const ms = new Date(entry?.at ?? 0).getTime();
    return Number.isFinite(ms) && (now - ms) <= (30 * DAY_MS);
  });
  const pirDelta30 = recentHistory.reduce((sum, row) => sum + Number(row?.delta ?? 0), 0);
  const pirProgressScore = clamp(Math.round(50 + pirDelta30 * 0.8), 0, 100);
  return clamp(
    Math.round(frequencyScore * 0.3 + resultScore * 0.3 + streakScore * 0.2 + pirProgressScore * 0.2),
    0,
    100,
  );
}

function buildContextualMessage({ profile, daysSinceLastMatch, latestMatch, usersById }) {
  if (profile?.comebackMode?.active) {
    return {
      type: 'comeback',
      days: daysSinceLastMatch,
    };
  }

  const topRival = safeArray(profile?.rivalries)[0];
  if (topRival && topRival.wins === 0 && topRival.losses >= 2) {
    return {
      type: 'rivalry_never_beaten',
      opponentId: topRival.opponentId,
      opponentName: usersById.get(topRival.opponentId)?.displayName ?? null,
      count: topRival.losses,
    };
  }

  if (latestMatch?.isKeyMatch) {
    return {
      type: 'key_match',
      score: `${safeArray(latestMatch?.sets).map((set) => `${set.a}-${set.b}`).join(' / ') || 'N/A'}`,
    };
  }

  if (profile?.activityStreak?.count >= 4) {
    return {
      type: 'streak',
      count: profile.activityStreak.count,
    };
  }

  return {
    type: 'objective',
    current: profile?.objective?.current ?? 0,
    target: profile?.objective?.target ?? 0,
  };
}

export async function computePlayerProfile(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const allMatches = safeArray(await store.listMatchesForUser(userId))
    .filter((match) => match?.status === 'validated')
    .sort((a, b) => matchTimeMs(b) - matchTimeMs(a));
  const now = Date.now();
  const recent30Matches = allMatches.filter((match) => now - matchTimeMs(match) <= 30 * DAY_MS);
  const recent90Matches = allMatches.filter((match) => now - matchTimeMs(match) <= 90 * DAY_MS);
  const latestMatch = allMatches[0] ?? null;
  const daysSinceLastMatch = latestMatch
    ? Math.floor((now - matchTimeMs(latestMatch)) / DAY_MS)
    : 999;

  const history = safeArray(user?.history);
  const winStreak = computeWinStreak(history);
  const hasTournament = allMatches.some((match) => Boolean(match?.tournamentId) || match?.matchFormat === 'club');

  const autoType = inferProfileType({
    recent90Matches,
    daysSinceLastMatch,
    hasTournament,
    winStreak,
  });
  const profileType = PROFILE_TYPES.has(user?.playerProfile?.typeOverride)
    ? user.playerProfile.typeOverride
    : autoType;

  const users = await store.listUsers();
  const usersById = new Map(users.map((entry) => [entry.id, entry]));
  const personality = inferPersonality({
    recentMatches: allMatches.slice(0, 20),
    userId,
    usersById,
  });

  const streak = activityStreak(allMatches);
  const objective = computeObjective(profileType, recent30Matches.length);
  const formScore = computeFormScore({
    recent30Matches,
    history,
    streakCount: streak.count,
  });
  const rivalries = computeRivalries(allMatches, userId);
  const comebackActive = daysSinceLastMatch > 14;

  const profile = {
    type: profileType,
    typeOverride: PROFILE_TYPES.has(user?.playerProfile?.typeOverride) ? user.playerProfile.typeOverride : null,
    personality: PERSONALITIES.has(personality) ? personality : 'regular',
    lastEvaluatedAt: new Date().toISOString(),
    formScore,
    activityStreak: {
      count: streak.count,
      unit: streak.unit,
      lastActivityAt: streak.lastActivityAt,
    },
    comebackMode: {
      active: comebackActive,
      daysSinceLastMatch: daysSinceLastMatch >= 999 ? null : daysSinceLastMatch,
      bonusApplied: false,
    },
    objective,
    rivalries,
  };

  const message = buildContextualMessage({
    profile,
    daysSinceLastMatch: daysSinceLastMatch >= 999 ? 0 : daysSinceLastMatch,
    latestMatch,
    usersById,
  });

  return {
    userId,
    playerProfile: profile,
    contextualMessage: message,
  };
}

export async function evaluateAndPersistPlayerProfile(userId) {
  const result = await computePlayerProfile(userId);
  if (typeof store.updatePlayerProfile === 'function') {
    await store.updatePlayerProfile(userId, result.playerProfile);
  } else {
    const user = await store.getUserById(userId);
    if (user) {
      await store.updateUser(userId, {
        playerProfile: result.playerProfile,
      });
    }
  }
  return result;
}

export async function getPlayerProfile(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const current = user?.playerProfile;
  if (current && current.lastEvaluatedAt) {
    const users = await store.listUsers();
    const usersById = new Map(users.map((entry) => [entry.id, entry]));
    const matches = safeArray(await store.listMatchesForUser(userId))
      .filter((match) => match?.status === 'validated')
      .sort((a, b) => matchTimeMs(b) - matchTimeMs(a));
    return {
      userId,
      playerProfile: current,
      contextualMessage: buildContextualMessage({
        profile: current,
        daysSinceLastMatch: matches[0] ? Math.floor((Date.now() - matchTimeMs(matches[0])) / DAY_MS) : 0,
        latestMatch: matches[0] ?? null,
        usersById,
      }),
    };
  }

  return evaluateAndPersistPlayerProfile(userId);
}
