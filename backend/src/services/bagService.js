import { store } from '../store/index.js';

function estimateHoursPerMatch(match) {
  const totalGames = match.sets.reduce((sum, set) => sum + set.a + set.b, 0);
  return Math.max(0.6, totalGames * 0.05);
}

export async function addRacket(userId, payload) {
  if (!payload.model || !payload.brand) {
    throw new Error('brand and model are required');
  }

  return store.addBagItem(userId, {
    type: payload.type ?? 'racket',
    brand: payload.brand,
    model: payload.model,
    maxHours: payload.maxHours ?? 120,
    notes: payload.notes ?? '',
  });
}

export async function getBag(userId) {
  const items = await store.listBagItems(userId);
  const matches = (await store.listMatchesForUser(userId)).filter((m) => m.status === 'validated');

  const totalHours = matches.reduce((sum, match) => sum + estimateHoursPerMatch(match), 0);

  return items.map((item) => {
    const hoursPlayed = Number(totalHours.toFixed(2));
    const wearRatio = Math.min(1, hoursPlayed / item.maxHours);

    return {
      ...item,
      hoursPlayed,
      wearPercent: Number((wearRatio * 100).toFixed(1)),
      needsReplacement: wearRatio >= 1,
    };
  });
}
