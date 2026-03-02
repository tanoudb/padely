import { store } from '../store/index.js';
import { upsertUserPushToken } from './pushService.js';

const PLAYER_RHYTHMS = new Set(['light', 'regular', 'intense']);

function normalizePlayerRhythm(value, fallback = 'regular') {
  const raw = String(value ?? '').toLowerCase();
  if (PLAYER_RHYTHMS.has(raw)) {
    return raw;
  }
  return fallback;
}

function normalizePinnedBadges(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return [...new Set(input
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))]
    .slice(0, 3);
}

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

  const incomingSettings = {
    ...(payload.settings ?? {}),
  };

  const settings = {
    ...user.settings,
    ...incomingSettings,
    playerRhythm: normalizePlayerRhythm(
      incomingSettings.playerRhythm ?? user.settings?.playerRhythm ?? 'regular',
      user.settings?.playerRhythm ?? 'regular',
    ),
    pinnedBadges: incomingSettings.pinnedBadges !== undefined
      ? normalizePinnedBadges(incomingSettings.pinnedBadges)
      : normalizePinnedBadges(user.settings?.pinnedBadges ?? []),
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
  const nextCity = typeof payload.city === 'string' && payload.city.trim()
    ? payload.city.trim()
    : user.city;
  const preferences = payload.preferences ?? {};
  const notifications = preferences.notifications ?? {};
  const nextSettings = {
    ...user.settings,
    defaultMatchMode: preferences.defaultMatchMode ?? user.settings?.defaultMatchMode ?? 'ranked',
    matchFormat: preferences.matchFormat ?? user.settings?.matchFormat ?? 'marathon',
    pointRule: preferences.pointRule ?? user.settings?.pointRule ?? 'punto_de_oro',
    playerRhythm: normalizePlayerRhythm(
      preferences.playerRhythm ?? user.settings?.playerRhythm ?? 'regular',
      user.settings?.playerRhythm ?? 'regular',
    ),
    autoSaveMatch: preferences.autoSaveMatch ?? user.settings?.autoSaveMatch ?? true,
    notificationPreferences: {
      ...(user.settings?.notificationPreferences ?? {}),
      matchInvites: notifications.matchInvites ?? user.settings?.notificationPreferences?.matchInvites ?? true,
      partnerAvailability: notifications.partnerAvailability ?? user.settings?.notificationPreferences?.partnerAvailability ?? true,
      leaderboardMovement: notifications.leaderboardMovement ?? user.settings?.notificationPreferences?.leaderboardMovement ?? true,
    },
  };
  const nextPrivacy = {
    ...user.privacy,
    publicProfile: preferences.publicProfile ?? user.privacy?.publicProfile ?? true,
    showGuestMatches: preferences.showGuestMatches ?? user.privacy?.showGuestMatches ?? false,
    showHealthStats: preferences.showHealthStats ?? user.privacy?.showHealthStats ?? true,
  };

  const updated = await store.updateUser(userId, {
    athlete: {
      ...user.athlete,
      level,
    },
    rating: baseRating,
    city: nextCity,
    settings: nextSettings,
    privacy: nextPrivacy,
    onboarding: {
      completed: true,
      quizAnswers: payload.quizAnswers ?? null,
      completedAt: new Date().toISOString(),
      city: nextCity ?? null,
      preferences: {
        defaultMatchMode: nextSettings.defaultMatchMode,
        matchFormat: nextSettings.matchFormat,
        pointRule: nextSettings.pointRule,
        playerRhythm: nextSettings.playerRhythm,
        autoSaveMatch: nextSettings.autoSaveMatch,
        notifications: nextSettings.notificationPreferences,
      },
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

export async function updatePushToken(userId, payload) {
  const result = await upsertUserPushToken(userId, payload);
  return {
    ok: true,
    ...result,
  };
}

export async function updatePinnedBadges(userId, payload = {}) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const pinnedBadges = normalizePinnedBadges(payload.pinnedBadges);
  const updated = await store.updateUser(userId, {
    settings: {
      ...(user.settings ?? {}),
      pinnedBadges,
    },
  });

  const { passwordHash, ...safe } = updated;
  return {
    ...safe,
    settings: {
      ...(safe.settings ?? {}),
      pinnedBadges,
    },
  };
}
