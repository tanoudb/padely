import { store } from '../store/index.js';

export async function updateAthleteProfile(userId, payload) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const athlete = {
    ...user.athlete,
    weightKg: payload.weightKg ?? user.athlete.weightKg,
    heightCm: payload.heightCm ?? user.athlete.heightCm,
    dominantHand: payload.dominantHand ?? user.athlete.dominantHand,
  };

  const location = payload.location ?? user.location;
  const city = payload.city ?? user.city;

  const updated = await store.updateUser(userId, {
    athlete,
    city,
    location,
    watch: {
      ...user.watch,
      enabled: payload.watchEnabled ?? user.watch.enabled,
      provider: payload.watchProvider ?? user.watch.provider,
    },
  });

  const { passwordHash, ...safe } = updated;
  return safe;
}

export async function getProfile(userId) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const { passwordHash, ...safe } = user;
  return safe;
}
