import { store } from '../store/index.js';

async function matchesForUser(userId) {
  return (await store
    .listMatchesForUser(userId))
    .filter((m) => m.status === 'validated');
}

function totalGames(sets) {
  return sets.reduce((sum, set) => sum + set.a + set.b, 0);
}

function estimateMinutes(match) {
  return Math.round(totalGames(match.sets) * 3.2);
}

function winnerTeam(match) {
  const a = match.sets.filter((s) => s.a > s.b).length;
  const b = match.sets.filter((s) => s.b > s.a).length;
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

function computeRegularityScore(matches) {
  if (matches.length < 2) {
    return 50;
  }

  const sorted = [...matches].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const gaps = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const gapDays = (new Date(sorted[i].createdAt) - new Date(sorted[i - 1].createdAt)) / (1000 * 60 * 60 * 24);
    gaps.push(gapDays);
  }

  const avgGap = average(gaps);
  const score = 100 - Math.min(100, avgGap * 6);
  return Math.round(score);
}

function computeConsistencyScore(matches, userId) {
  if (!matches.length) {
    return 0;
  }

  const performances = matches.map((match) => {
    const isTeamA = match.teamA.includes(userId);
    const won = (isTeamA && winnerTeam(match) === 'A') || (!isTeamA && winnerTeam(match) === 'B');

    const gamesFor = match.sets.reduce((s, set) => s + (isTeamA ? set.a : set.b), 0);
    const gamesAgainst = match.sets.reduce((s, set) => s + (isTeamA ? set.b : set.a), 0);
    const gameDiff = gamesFor - gamesAgainst;

    return (won ? 1 : 0) * 10 + gameDiff;
  });

  const mean = average(performances);
  const variance = average(performances.map((p) => (p - mean) ** 2));
  const stdDev = Math.sqrt(variance);

  const score = 100 - Math.min(100, stdDev * 8);
  return Math.round(score);
}

export async function getDashboard(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const matches = await matchesForUser(userId);
  const minutes = matches.reduce((sum, m) => sum + estimateMinutes(m), 0);

  const wins = matches.filter((m) => {
    const isA = m.teamA.includes(userId);
    return (isA && winnerTeam(m) === 'A') || (!isA && winnerTeam(m) === 'B');
  }).length;

  const losses = matches.length - wins;
  const watches = matches.map((match) => playerWatch(match, userId));
  const totalDistanceKm = Number(watches.reduce((sum, w) => sum + w.distanceKm, 0).toFixed(2));
  const averageDistanceKm = Number((matches.length ? totalDistanceKm / matches.length : 0).toFixed(2));
  const calories = Math.round(watches.reduce((sum, w) => sum + w.calories, 0));
  const averageHeartRate = Math.round(average(watches.filter((w) => w.heartRateAvg > 0).map((w) => w.heartRateAvg)));
  const averageOxygen = Math.round(average(watches.filter((w) => w.oxygenAvg > 0).map((w) => w.oxygenAvg)));

  return {
    userId,
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
  };
}

export async function getDuoStats(userId) {
  const matches = await matchesForUser(userId);
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

    const won = (userInTeamA && winnerTeam(match) === 'A') || (!userInTeamA && winnerTeam(match) === 'B');

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

export async function getPerformanceHoles(userId) {
  const matches = await matchesForUser(userId);
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
    findings: clues,
    recommendations,
  };
}
