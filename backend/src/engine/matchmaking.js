import { winProbability } from '../domain/pir.js';
import { round } from '../domain/math.js';

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function teamRating(team) {
  return average(team.map((player) => player.rating));
}

function distanceKm(a, b) {
  if (typeof a.lat !== 'number' || typeof a.lng !== 'number') {
    return 0;
  }
  if (typeof b.lat !== 'number' || typeof b.lng !== 'number') {
    return 0;
  }

  const earthRadius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function pairingDistance(teamA, teamB) {
  const all = [...teamA, ...teamB];
  const center = {
    lat: average(all.map((p) => p.lat ?? 0)),
    lng: average(all.map((p) => p.lng ?? 0)),
  };

  return average(all.map((player) => distanceKm(player, center)));
}

function pairings(players) {
  const [a, b, c, d] = players;
  return [
    {
      teamA: [a, b],
      teamB: [c, d],
    },
    {
      teamA: [a, c],
      teamB: [b, d],
    },
    {
      teamA: [a, d],
      teamB: [b, c],
    },
  ];
}

function combinations(items, size) {
  if (size === 0) {
    return [[]];
  }
  if (items.length < size) {
    return [];
  }

  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

export function findBalancedMatches(players, { maxResults = 5 } = {}) {
  if (players.length < 4) {
    return [];
  }

  const groups = combinations(players, 4);
  const scenarios = [];

  for (const group of groups) {
    for (const option of pairings(group)) {
      const ratingA = teamRating(option.teamA);
      const ratingB = teamRating(option.teamB);
      const winA = winProbability(ratingA, ratingB);
      const imbalance = Math.abs(0.5 - winA);
      const geoPenalty = pairingDistance(option.teamA, option.teamB) / 30;

      const score = imbalance + geoPenalty;
      scenarios.push({
        score,
        probabilityTeamA: round(winA, 3),
        probabilityTeamB: round(1 - winA, 3),
        ratingA: round(ratingA, 2),
        ratingB: round(ratingB, 2),
        teamA: option.teamA.map((p) => p.id),
        teamB: option.teamB.map((p) => p.id),
      });
    }
  }

  return scenarios
    .sort((left, right) => left.score - right.score)
    .slice(0, maxResults)
    .map(({ score, ...scenario }) => ({
      ...scenario,
      fairnessScore: round(1 - Math.min(score, 1), 3),
    }));
}
