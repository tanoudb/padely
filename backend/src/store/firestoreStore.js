import { newId } from '../utils/id.js';

function nowIso() {
  return new Date().toISOString();
}

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
      avatarUrl: null,
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
      friends: [],
      calibration: {
        remainingMatches: 5,
      },
      history: [],
      watch: {
        enabled: false,
      },
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
    const current = await this.getUserById(id);
    if (!current) {
      return null;
    }

    const merged = { ...current, ...patch };
    await this.users().doc(id).set(merged);
    return merged;
  }

  async createSession(userId, token) {
    await this.ensureReady();
    await this.sessions().doc(token).set({
      token,
      userId,
      createdAt: nowIso(),
    });
  }

  async createEmailVerificationToken(userId, token, expiresAt) {
    await this.ensureReady();
    await this.emailVerifications().doc(token).set({
      token,
      userId,
      expiresAt,
      createdAt: nowIso(),
    });
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

  async getSession(token) {
    await this.ensureReady();
    const doc = await this.sessions().doc(token).get();
    return doc.exists ? doc.data() : null;
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
    const current = await this.getMatch(id);
    if (!current) {
      return null;
    }

    const merged = { ...current, ...patch };
    await this.matches().doc(id).set(merged);
    return merged;
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
