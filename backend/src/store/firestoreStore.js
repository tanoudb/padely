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

const BADGE_TIER_ORDER = ['bronze', 'silver', 'gold', 'mythic'];

function normalizeBadgeTier(value, fallback = 'gold') {
  const raw = String(value ?? '').toLowerCase();
  return BADGE_TIER_ORDER.includes(raw) ? raw : fallback;
}

function higherBadgeTier(currentTier, nextTier) {
  const currentIndex = BADGE_TIER_ORDER.indexOf(normalizeBadgeTier(currentTier, 'bronze'));
  const nextIndex = BADGE_TIER_ORDER.indexOf(normalizeBadgeTier(nextTier, 'bronze'));
  return nextIndex > currentIndex ? normalizeBadgeTier(nextTier, 'bronze') : normalizeBadgeTier(currentTier, 'bronze');
}

const DEFAULT_PLAYER_PROFILE = {
  type: 'chill',
  typeOverride: null,
  personality: null,
  lastEvaluatedAt: null,
  formScore: 0,
  activityStreak: {
    count: 0,
    unit: 'day',
    lastActivityAt: null,
  },
  comebackMode: {
    active: false,
    daysSinceLastMatch: 0,
    bonusApplied: false,
  },
  objective: {
    type: 'maintain',
    target: 1,
    current: 0,
    deadline: null,
  },
  rivalries: [],
};

export class FirestoreStore {
  constructor() {
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    const { initializeApp, getApps, applicationDefault, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    const hasApp = getApps().length > 0;
    if (!hasApp) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson) {
        initializeApp({
          credential: cert(JSON.parse(serviceAccountJson)),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      } else {
        initializeApp({
          credential: applicationDefault(),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
      }
    }

    this.db = getFirestore();
  }

  async ensureReady() {
    await this.ready;
  }

  users() { return this.db.collection('users'); }
  sessions() { return this.db.collection('sessions'); }
  emailVerifications() { return this.db.collection('emailVerifications'); }
  matches() { return this.db.collection('matches'); }
  validations() { return this.db.collection('validations'); }
  bagItems() { return this.db.collection('bagItems'); }
  marketplace() { return this.db.collection('marketplace'); }
  pairRatings() { return this.db.collection('pairRatings'); }
  leaderboards() { return this.db.collection('leaderboards'); }
  badges() { return this.db.collection('badges'); }

  async createUser({ email, passwordHash, provider, displayName, isVerified }) {
    await this.ensureReady();
    const id = newId('usr');
    const user = {
      id,
      email,
      emailLower: email.toLowerCase(),
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
        playerRhythm: 'regular',
        pinnedBadges: [],
      },
      privacy: {
        publicProfile: true,
        showGuestMatches: false,
        showHealthStats: true,
      },
      community: {
        customChannels: [],
        joinedClubChannels: [],
        readMarkers: {
          channels: {},
          dms: {},
        },
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
      playerProfile: { ...DEFAULT_PLAYER_PROFILE },
    };

    await this.users().doc(id).set(user);
    return user;
  }

  async getUserById(id) {
    await this.ensureReady();
    const doc = await this.users().doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async getUserByEmail(email) {
    await this.ensureReady();
    const snap = await this.users().where('emailLower', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) {
      return null;
    }
    return snap.docs[0].data();
  }

  async updateUser(id, patch) {
    await this.ensureReady();
    const ref = this.users().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }
    await ref.set(patch, { merge: true });
    const fresh = await ref.get();
    return fresh.data();
  }

  async updatePlayerProfile(userId, profileData = {}) {
    await this.ensureReady();
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    return this.updateUser(userId, {
      playerProfile: {
        ...(user.playerProfile ?? DEFAULT_PLAYER_PROFILE),
        ...(profileData ?? {}),
        rivalries: Array.isArray(profileData?.rivalries)
          ? profileData.rivalries
          : (user.playerProfile?.rivalries ?? []),
      },
    });
  }

  async createSession(userId, token, ttlMs) {
    await this.ensureReady();
    await this.sessions().doc(token).set({
      token,
      userId,
      createdAt: nowIso(),
      expiresAt: withTtl(ttlMs),
    });
  }

  async createEmailVerificationToken(userId, token, code, expiresAt) {
    await this.ensureReady();
    await this.emailVerifications().doc(token).set({
      token,
      userId,
      code: String(code),
      expiresAt,
      createdAt: nowIso(),
    });
  }

  async deleteEmailVerificationTokensForUser(userId) {
    await this.ensureReady();
    const snap = await this.emailVerifications().where('userId', '==', userId).get();
    await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
  }

  async consumeEmailVerificationToken(token) {
    await this.ensureReady();
    const ref = this.emailVerifications().doc(token);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    await ref.delete();
    return data;
  }

  async consumeEmailVerificationCode(userId, code) {
    await this.ensureReady();
    const snap = await this.emailVerifications()
      .where('userId', '==', userId)
      .where('code', '==', String(code).trim())
      .limit(1)
      .get();
    if (snap.empty) {
      return null;
    }
    const doc = snap.docs[0];
    const data = doc.data();
    await doc.ref.delete();
    return data;
  }

  async getSession(token) {
    await this.ensureReady();
    const ref = this.sessions().doc(token);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      await ref.delete();
      return null;
    }
    return data;
  }

  async createMatch(match) {
    await this.ensureReady();
    const id = newId('mat');
    const record = {
      ...match,
      id,
      createdAt: nowIso(),
      status: 'pending_validation',
    };
    await this.matches().doc(id).set(record);
    return record;
  }

  async updateMatch(id, patch) {
    await this.ensureReady();
    const ref = this.matches().doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return null;
    }
    await ref.set(patch, { merge: true });
    const fresh = await ref.get();
    return fresh.data();
  }

  async getMatch(id) {
    await this.ensureReady();
    const doc = await this.matches().doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async listMatchesForUser(userId) {
    await this.ensureReady();
    const snap = await this.matches().where('players', 'array-contains', userId).get();
    return snap.docs.map((d) => d.data());
  }

  async createValidation({ matchId, userId, accepted }) {
    await this.ensureReady();
    const id = newId('val');
    const item = {
      id,
      matchId,
      userId,
      accepted,
      createdAt: nowIso(),
    };

    await this.validations().doc(id).set(item);
    return item;
  }

  async listValidations(matchId) {
    await this.ensureReady();
    const snap = await this.validations().where('matchId', '==', matchId).get();
    return snap.docs.map((d) => d.data());
  }

  async addBagItem(userId, item) {
    await this.ensureReady();
    const id = newId('bag');
    const record = {
      id,
      userId,
      createdAt: nowIso(),
      hoursPlayed: 0,
      ...item,
    };

    await this.bagItems().doc(id).set(record);
    return record;
  }

  async listBagItems(userId) {
    await this.ensureReady();
    const snap = await this.bagItems().where('userId', '==', userId).get();
    return snap.docs.map((d) => d.data());
  }

  async upsertPairRating(pairKey, rating) {
    await this.ensureReady();
    await this.pairRatings().doc(pairKey).set({ pairKey, rating });
  }

  async getPairRating(pairKey) {
    await this.ensureReady();
    const doc = await this.pairRatings().doc(pairKey).get();
    return doc.exists ? doc.data().rating : null;
  }

  async addMarketplaceListing(payload) {
    await this.ensureReady();
    const id = newId('mkp');
    const record = {
      id,
      createdAt: nowIso(),
      status: 'active',
      ...payload,
    };

    await this.marketplace().doc(id).set(record);
    return record;
  }

  async listMarketplace({ city, category } = {}) {
    await this.ensureReady();
    let query = this.marketplace().where('status', '==', 'active');
    if (city) {
      query = query.where('city', '==', city);
    }
    if (category) {
      query = query.where('category', '==', category);
    }

    const snap = await query.get();
    return snap.docs.map((d) => d.data());
  }

  async listUsers() {
    await this.ensureReady();
    const snap = await this.users().get();
    return snap.docs.map((d) => d.data());
  }

  async unlockBadge(userId, badgeKey, meta = {}) {
    await this.ensureReady();
    const id = `${userId}:${badgeKey}`;
    const ref = this.badges().doc(id);
    const doc = await ref.get();
    const tier = normalizeBadgeTier(meta?.tier, 'gold');
    if (doc.exists) {
      const row = doc.data();
      const nextTier = higherBadgeTier(row.tier, tier);
      const mergedMeta = {
        ...(row.meta ?? {}),
        ...(meta ?? {}),
        tier: nextTier,
      };
      await ref.set({
        ...row,
        tier: nextTier,
        meta: mergedMeta,
      }, { merge: true });
      return {
        ...row,
        tier: nextTier,
        meta: mergedMeta,
        created: false,
      };
    }

    const created = {
      id,
      userId,
      badgeKey,
      tier,
      unlockedAt: nowIso(),
      meta: { ...(meta ?? {}), tier },
    };
    await ref.set(created);
    return {
      ...created,
      created: true,
    };
  }

  async updateBadgeTier(userId, badgeKey, newTier, meta = {}) {
    return this.unlockBadge(userId, badgeKey, {
      ...(meta ?? {}),
      tier: normalizeBadgeTier(newTier, 'gold'),
    });
  }

  async listBadgesForUser(userId) {
    await this.ensureReady();
    const snap = await this.badges().where('userId', '==', userId).orderBy('unlockedAt', 'desc').get();
    return snap.docs.map((doc) => {
      const row = doc.data();
      const tier = normalizeBadgeTier(row.tier, 'gold');
      return {
        ...row,
        tier,
        meta: {
          ...(row.meta ?? {}),
          tier,
        },
      };
    });
  }

  async setLeaderboard(city, rows) {
    await this.ensureReady();
    await this.leaderboards().doc(city.toLowerCase()).set({
      city: city.toLowerCase(),
      rows,
      updatedAt: nowIso(),
    });
  }

  async getLeaderboard(city) {
    await this.ensureReady();
    const doc = await this.leaderboards().doc(city.toLowerCase()).get();
    return doc.exists ? (doc.data().rows ?? []) : [];
  }
}
