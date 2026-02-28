import { inactivityDecay, softReset } from '../domain/pir.js';
import { store } from '../store/index.js';

export async function evaluateBadges(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const matches = (await store.listMatchesForUser(userId)).filter((m) => m.status === 'validated');
  const wins = matches.filter((m) => {
    const aWins = m.sets.filter((s) => s.a > s.b).length >= m.sets.filter((s) => s.b > s.a).length;
    return (m.teamA.includes(userId) && aWins) || (m.teamB.includes(userId) && !aWins);
  }).length;

  const badges = [];
  if (matches.length >= 20) {
    badges.push('Le Marathonien');
  }
  if (wins >= 10) {
    badges.push('Serial Winner');
  }
  if ((user.pir ?? 0) >= 70) {
    badges.push('Smash-Master');
  }

  return {
    userId,
    badges,
  };
}

export async function runSeasonSoftReset() {
  const users = await store.listUsers();
  const updates = [];

  for (const user of users) {
    const newRating = softReset(user.rating);
    await store.updateUser(user.id, { rating: newRating });
    updates.push({ userId: user.id, previous: user.rating, next: newRating });
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
