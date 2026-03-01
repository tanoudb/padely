import { store } from '../store/index.js';

function ratingFromLevel(level) {
  if (level <= 2) return 800;
  if (level <= 4) return 1200;
  if (level <= 5) return 1500;
  if (level <= 6) return 1800;
  if (level <= 7) return 2100;
  return 2400;
}

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
    displayName: payload.displayName ?? user.displayName,
    avatarUrl: payload.avatarUrl ?? user.avatarUrl,
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

export async function updateUserSettings(userId, payload) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const settings = {
    ...user.settings,
    ...(payload.settings ?? {}),
  };
  const privacy = {
    ...user.privacy,
    ...(payload.privacy ?? {}),
  };

  const updated = await store.updateUser(userId, {
    settings,
    privacy,
  });

  const { passwordHash, ...safe } = updated;
  return safe;
}

export async function completeOnboarding(userId, payload) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const level = Number(payload.level);
  if (!Number.isFinite(level) || level < 1 || level > 8) {
    throw new Error('Level must be between 1 and 8');
  }

  const baseRating = ratingFromLevel(level);
  const updated = await store.updateUser(userId, {
    athlete: {
      ...user.athlete,
      level,
    },
    rating: baseRating,
    onboarding: {
      completed: true,
      quizAnswers: payload.quizAnswers ?? null,
      completedAt: new Date().toISOString(),
    },
    calibration: {
      matchesPlayed: 0,
      remainingMatches: 10,
    },
    history: [],
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
