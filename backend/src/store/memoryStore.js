import { newId } from '../utils/id.js';

function nowIso() {
  return new Date().toISOString();
}

function withTtl(ttlMs) {
  const safeTtl = Math.max(60 * 1000, Number(ttlMs) || 72 * 60 * 60 * 1000);
  return new Date(Date.now() + safeTtl).toISOString();
}

function makeArcadeTag(displayName, id) {
  const base = String(displayName ?? 'player')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 7)
    .toUpperCase() || 'PLAYER';
  const suffix = String(id ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  return `${base}#${suffix}`;
}

export class MemoryStore {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.sessions = new Map();
    this.emailVerifications = new Map();
    this.matches = new Map();
    this.validations = new Map();
    this.bagItems = new Map();
    this.marketplace = new Map();
    this.cityLeaderboard = new Map();
    this.pairRatings = new Map();
  }

  createUser({ email, passwordHash, provider, displayName, isVerified }) {
    const id = newId('usr');
    const user = {
      id,
      email,
      passwordHash,
      provider,
      displayName,
      arcadeTag: makeArcadeTag(displayName, id),
      avatarUrl: null,
      isAdmin: false,
      createdAt: nowIso(),
      isVerified: typeof isVerified === 'boolean' ? isVerified : provider !== 'email',
      athlete: {
        weightKg: null,
        heightCm: null,
        level: null,
      },
      city: null,
      location: null,
      rating: 1200,
      pir: 50,
      onboarding: {
        completed: false,
        quizAnswers: null,
      },
      settings: {
        pointRule: 'punto_de_oro',
        matchFormat: 'marathon',
        autoSideSwitch: true,
      },
      privacy: {
        publicProfile: true,
        showGuestMatches: false,
        showHealthStats: true,
      },
      community: {
        customChannels: [],
        joinedClubChannels: [],
      },
      friends: [],
      calibration: {
        matchesPlayed: 0,
        remainingMatches: 10,
      },
      history: [],
      watch: {
        enabled: false,
      },
      pushTokens: [],
    };

    this.users.set(id, user);
    this.usersByEmail.set(email.toLowerCase(), id);
    return user;
  }

  getUserById(id) {
    return this.users.get(id) ?? null;
  }

  getUserByEmail(email) {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.getUserById(id) : null;
  }

  updateUser(id, patch) {
    const user = this.getUserById(id);
    if (!user) {
      return null;
    }

    Object.assign(user, patch);
    this.users.set(id, user);
    return user;
  }

  createSession(userId, token, ttlMs) {
    this.sessions.set(token, {
      token,
      userId,
      createdAt: nowIso(),
      expiresAt: withTtl(ttlMs),
    });
  }

  createEmailVerificationToken(userId, token, code, expiresAt) {
    this.emailVerifications.set(token, {
      token,
      userId,
      code: String(code),
      expiresAt,
      createdAt: nowIso(),
    });
  }

  deleteEmailVerificationTokensForUser(userId) {
    for (const [token, item] of this.emailVerifications.entries()) {
      if (item.userId === userId) {
        this.emailVerifications.delete(token);
      }
    }
  }

  consumeEmailVerificationToken(token) {
    const current = this.emailVerifications.get(token) ?? null;
    if (!current) {
      return null;
    }
    this.emailVerifications.delete(token);
    return current;
  }

  consumeEmailVerificationCode(userId, code) {
    const wanted = String(code).trim();
    let matchToken = null;
    let matchItem = null;

    for (const [token, item] of this.emailVerifications.entries()) {
      if (item.userId === userId && String(item.code) === wanted) {
        if (!matchItem || item.createdAt > matchItem.createdAt) {
          matchToken = token;
          matchItem = item;
        }
      }
    }

    if (!matchToken || !matchItem) {
      return null;
    }

    this.emailVerifications.delete(matchToken);
    return matchItem;
  }

  getSession(token) {
    const current = this.sessions.get(token) ?? null;
    if (!current) {
      return null;
    }
    if (current.expiresAt && new Date(current.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return current;
  }

  createMatch(match) {
    const id = newId('mat');
    const record = {
      ...match,
      id,
      createdAt: nowIso(),
      status: 'pending_validation',
    };
    this.matches.set(id, record);
    return record;
  }

  updateMatch(id, patch) {
    const match = this.matches.get(id);
    if (!match) {
      return null;
    }

    Object.assign(match, patch);
    this.matches.set(id, match);
    return match;
  }

  getMatch(id) {
    return this.matches.get(id) ?? null;
  }

  listMatchesForUser(userId) {
    return [...this.matches.values()].filter((match) =>
      [...match.teamA, ...match.teamB].includes(userId)
    );
  }

  createValidation({ matchId, userId, accepted }) {
    const id = newId('val');
    const item = {
      id,
      matchId,
      userId,
      accepted,
      createdAt: nowIso(),
    };

    this.validations.set(id, item);
    return item;
  }

  listValidations(matchId) {
    return [...this.validations.values()].filter((v) => v.matchId === matchId);
  }

  addBagItem(userId, item) {
    const id = newId('bag');
    const record = {
      id,
      userId,
      createdAt: nowIso(),
      hoursPlayed: 0,
      ...item,
    };

    if (!this.bagItems.has(userId)) {
      this.bagItems.set(userId, []);
    }

    this.bagItems.get(userId).push(record);
    return record;
  }

  listBagItems(userId) {
    return this.bagItems.get(userId) ?? [];
  }

  upsertPairRating(pairKey, rating) {
    this.pairRatings.set(pairKey, rating);
  }

  getPairRating(pairKey) {
    return this.pairRatings.get(pairKey) ?? null;
  }

  addMarketplaceListing(payload) {
    const id = newId('mkp');
    const record = {
      id,
      createdAt: nowIso(),
      status: 'active',
      ...payload,
    };

    this.marketplace.set(id, record);
    return record;
  }

  listMarketplace({ city, category } = {}) {
    return [...this.marketplace.values()].filter((item) => {
      if (city && item.city?.toLowerCase() !== city.toLowerCase()) {
        return false;
      }
      if (category && item.category !== category) {
        return false;
      }
      return item.status === 'active';
    });
  }

  listUsers() {
    return [...this.users.values()];
  }

  setLeaderboard(city, rows) {
    this.cityLeaderboard.set(city.toLowerCase(), rows);
  }

  getLeaderboard(city) {
    return this.cityLeaderboard.get(city.toLowerCase()) ?? [];
  }
}
