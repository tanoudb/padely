import { newId } from '../utils/id.js';

function nowIso() {
  return new Date().toISOString();
}

export class MemoryStore {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.sessions = new Map();
    this.matches = new Map();
    this.validations = new Map();
    this.bagItems = new Map();
    this.marketplace = new Map();
    this.cityLeaderboard = new Map();
    this.pairRatings = new Map();
  }

  createUser({ email, passwordHash, provider, displayName }) {
    const id = newId('usr');
    const user = {
      id,
      email,
      passwordHash,
      provider,
      displayName,
      createdAt: nowIso(),
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
      calibration: {
        remainingMatches: 5,
      },
      history: [],
      watch: {
        enabled: false,
      },
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

  createSession(userId, token) {
    this.sessions.set(token, {
      token,
      userId,
      createdAt: nowIso(),
    });
  }

  getSession(token) {
    return this.sessions.get(token) ?? null;
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
