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
  const calories = matches.length * 580;
  const distanceKm = Number((matches.length * 2.4).toFixed(2));

  return {
    userId,
    rating: user.rating,
    pir: user.pir,
    matches: matches.length,
    wins,
    losses,
    playTimeMinutes: minutes,
    calories,
    distanceKm,
    progression: user.history ?? [],
  };
}

export async function getDuoStats(userId) {
  const matches = await matchesForUser(userId);
  const duoMap = new Map();

  for (const match of matches) {
    const userInTeamA = match.teamA.includes(userId);
    const team = userInTeamA ? match.teamA : match.teamB;
    const partner = team.find((id) => id !== userId);
    const won = (userInTeamA && winnerTeam(match) === 'A') || (!userInTeamA && winnerTeam(match) === 'B');

    if (!duoMap.has(partner)) {
      duoMap.set(partner, {
        partnerId: partner,
        matches: 0,
        wins: 0,
      });
    }

    const item = duoMap.get(partner);
    item.matches += 1;
    item.wins += won ? 1 : 0;
  }

  return [...duoMap.values()].map((item) => ({
    ...item,
    winRate: item.matches ? Number(((item.wins / item.matches) * 100).toFixed(1)) : 0,
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
