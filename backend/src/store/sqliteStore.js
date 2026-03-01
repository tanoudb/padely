import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

function toBool(value, fallback = false) {
  if (value === null || value === undefined) {
    return fallback;
  }
  return Boolean(value);
}

function lower(text) {
  return String(text ?? '').toLowerCase();
}

function stablePairKey(userA, userB) {
  return [userA, userB].sort().join(':');
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeUser(raw) {
  if (!raw) {
    return null;
  }

  const community = raw.community && typeof raw.community === 'object' ? raw.community : {};
  const user = {
    ...raw,
    athlete: raw.athlete ?? { weightKg: null, heightCm: null, level: null },
    onboarding: raw.onboarding ?? { completed: false, quizAnswers: null },
    settings: raw.settings ?? {
      pointRule: 'punto_de_oro',
      matchFormat: 'marathon',
      autoSideSwitch: true,
    },
    privacy: raw.privacy ?? {
      publicProfile: true,
      showGuestMatches: false,
      showHealthStats: true,
    },
    community: {
      customChannels: Array.isArray(community.customChannels) ? community.customChannels : [],
      joinedClubChannels: Array.isArray(community.joinedClubChannels) ? community.joinedClubChannels : [],
      readMarkers: {
        channels: community.readMarkers?.channels && typeof community.readMarkers.channels === 'object'
          ? community.readMarkers.channels
          : {},
        dms: community.readMarkers?.dms && typeof community.readMarkers.dms === 'object'
          ? community.readMarkers.dms
          : {},
      },
    },
    friends: Array.isArray(raw.friends) ? raw.friends : [],
    calibration: raw.calibration ?? {
      matchesPlayed: 0,
      remainingMatches: 10,
    },
    history: Array.isArray(raw.history) ? raw.history : [],
    watch: raw.watch ?? { enabled: false },
    pushTokens: Array.isArray(raw.pushTokens) ? raw.pushTokens : [],
  };

  if (!user.arcadeTag) {
    user.arcadeTag = makeArcadeTag(user.displayName, user.id);
  }

  return user;
}

export class SQLiteStore {
  constructor(options = {}) {
    const requestedPath = options.dbPath
      ?? process.env.SQLITE_PATH
      ?? path.resolve(process.cwd(), '.data', 'padely.sqlite');

    this.dbPath = requestedPath;

    if (requestedPath !== ':memory:') {
      fs.mkdirSync(path.dirname(requestedPath), { recursive: true });
    }

    this.db = new DatabaseSync(requestedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    this.migrate();
    this.seedClubsCatalog();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email_lower TEXT UNIQUE NOT NULL,
        city_lower TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_city_lower ON users(city_lower);

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS email_verifications (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_email_verifications_user_code ON email_verifications(user_id, code);

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        players_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

      CREATE TABLE IF NOT EXISTS validations (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_validations_match ON validations(match_id);

      CREATE TABLE IF NOT EXISTS pairs (
        pair_key TEXT PRIMARY KEY,
        rating REAL NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leaderboard_cache (
        city_lower TEXT PRIMARY KEY,
        rows_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        badge_key TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        meta_json TEXT,
        UNIQUE(user_id, badge_key)
      );

      CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);

      CREATE TABLE IF NOT EXISTS clubs (
        key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        city TEXT NOT NULL,
        city_lower TEXT NOT NULL,
        join_code TEXT NOT NULL,
        join_code_lower TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_clubs_city_lower ON clubs(city_lower);
      CREATE INDEX IF NOT EXISTS idx_clubs_join_code_lower ON clubs(join_code_lower);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_scope ON messages(kind, scope_key, created_at);

      CREATE TABLE IF NOT EXISTS bag_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bag_items_user ON bag_items(user_id);

      CREATE TABLE IF NOT EXISTS marketplace (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        city_lower TEXT,
        category TEXT,
        created_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_marketplace_city_category ON marketplace(status, city_lower, category);
    `);
  }

  seedClubsCatalog() {
    const clubs = [
      {
        key: 'club:urban-padel-lyon',
        title: 'Urban Padel Lyon',
        city: 'Lyon',
        joinCode: 'UP-LYON-01',
      },
      {
        key: 'club:esprit-padel-villeurbanne',
        title: 'Esprit Padel Villeurbanne',
        city: 'Lyon',
        joinCode: 'EP-VILLEUR-02',
      },
      {
        key: 'club:casa-padel-paris',
        title: 'Casa Padel Paris',
        city: 'Paris',
        joinCode: 'CP-PARIS-01',
      },
    ];

    const statement = this.db.prepare(`
      INSERT INTO clubs (key, title, city, city_lower, join_code, join_code_lower, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        title = excluded.title,
        city = excluded.city,
        city_lower = excluded.city_lower,
        join_code = excluded.join_code,
        join_code_lower = excluded.join_code_lower
    `);

    const createdAt = nowIso();
    for (const club of clubs) {
      statement.run(
        club.key,
        club.title,
        club.city,
        lower(club.city),
        club.joinCode,
        lower(club.joinCode),
        createdAt,
      );
    }
  }

  serializeUser(user) {
    return JSON.stringify(normalizeUser(user));
  }

  mapUser(row) {
    if (!row) {
      return null;
    }
    return normalizeUser(parseJson(row.payload_json, null));
  }

  createUser({ email, passwordHash, provider, displayName, isVerified }) {
    const id = newId('usr');
    const user = normalizeUser({
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
      city: null,
      location: null,
      rating: 1200,
      pir: 50,
    });

    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO users (id, email_lower, city_lower, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      lower(email),
      null,
      this.serializeUser(user),
      timestamp,
      timestamp,
    );

    return user;
  }

  getUserById(id) {
    const row = this.db.prepare('SELECT payload_json FROM users WHERE id = ? LIMIT 1').get(id);
    return this.mapUser(row);
  }

  getUserByEmail(email) {
    const row = this.db
      .prepare('SELECT payload_json FROM users WHERE email_lower = ? LIMIT 1')
      .get(lower(email));
    return this.mapUser(row);
  }

  updateUser(id, patch) {
    const current = this.getUserById(id);
    if (!current) {
      return null;
    }

    const updated = normalizeUser({
      ...current,
      ...patch,
    });

    this.db.prepare(`
      UPDATE users
      SET payload_json = ?, city_lower = ?, updated_at = ?
      WHERE id = ?
    `).run(
      this.serializeUser(updated),
      updated.city ? lower(updated.city) : null,
      nowIso(),
      id,
    );

    return updated;
  }

  listUsers() {
    const rows = this.db.prepare('SELECT payload_json FROM users').all();
    return rows.map((row) => this.mapUser(row)).filter(Boolean);
  }

  createSession(userId, token, ttlMs) {
    const payload = {
      token,
      userId,
      createdAt: nowIso(),
      expiresAt: withTtl(ttlMs),
    };

    this.db.prepare(`
      INSERT OR REPLACE INTO sessions (token, user_id, expires_at, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, userId, payload.expiresAt, JSON.stringify(payload), payload.createdAt);
  }

  getSession(token) {
    const row = this.db.prepare('SELECT payload_json, expires_at FROM sessions WHERE token = ?').get(token);
    if (!row) {
      return null;
    }

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    return parseJson(row.payload_json, null);
  }

  createEmailVerificationToken(userId, token, code, expiresAt) {
    const payload = {
      token,
      userId,
      code: String(code),
      expiresAt,
      createdAt: nowIso(),
    };

    this.db.prepare(`
      INSERT OR REPLACE INTO email_verifications (token, user_id, code, expires_at, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, userId, payload.code, expiresAt, JSON.stringify(payload), payload.createdAt);
  }

  deleteEmailVerificationTokensForUser(userId) {
    this.db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(userId);
  }

  consumeEmailVerificationToken(token) {
    const row = this.db.prepare('SELECT payload_json FROM email_verifications WHERE token = ? LIMIT 1').get(token);
    if (!row) {
      return null;
    }

    this.db.prepare('DELETE FROM email_verifications WHERE token = ?').run(token);
    return parseJson(row.payload_json, null);
  }

  consumeEmailVerificationCode(userId, code) {
    const row = this.db.prepare(`
      SELECT token, payload_json
      FROM email_verifications
      WHERE user_id = ? AND code = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId, String(code).trim());

    if (!row) {
      return null;
    }

    this.db.prepare('DELETE FROM email_verifications WHERE token = ?').run(row.token);
    return parseJson(row.payload_json, null);
  }

  createMatch(match) {
    const id = newId('mat');
    const record = {
      ...match,
      id,
      createdAt: nowIso(),
      status: 'pending_validation',
    };

    const players = [...(record.teamA ?? []), ...(record.teamB ?? [])];

    this.db.prepare(`
      INSERT INTO matches (id, status, players_json, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      record.status,
      JSON.stringify(players),
      record.createdAt,
      JSON.stringify(record),
    );

    return record;
  }

  updateMatch(id, patch) {
    const current = this.getMatch(id);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...patch,
    };

    const players = [...(updated.teamA ?? []), ...(updated.teamB ?? [])];

    this.db.prepare(`
      UPDATE matches
      SET status = ?, players_json = ?, payload_json = ?
      WHERE id = ?
    `).run(
      updated.status ?? current.status ?? 'pending_validation',
      JSON.stringify(players),
      JSON.stringify(updated),
      id,
    );

    return updated;
  }

  getMatch(id) {
    const row = this.db.prepare('SELECT payload_json FROM matches WHERE id = ? LIMIT 1').get(id);
    return parseJson(row?.payload_json, null);
  }

  listMatchesForUser(userId) {
    const rows = this.db.prepare('SELECT payload_json FROM matches ORDER BY created_at DESC').all();
    return rows
      .map((row) => parseJson(row.payload_json, null))
      .filter((match) => match && [...(match.teamA ?? []), ...(match.teamB ?? [])].includes(userId));
  }

  createValidation({ matchId, userId, accepted }) {
    const id = newId('val');
    const item = {
      id,
      matchId,
      userId,
      accepted: Boolean(accepted),
      createdAt: nowIso(),
    };

    this.db.prepare(`
      INSERT INTO validations (id, match_id, user_id, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, matchId, userId, item.createdAt, JSON.stringify(item));

    return item;
  }

  listValidations(matchId) {
    const rows = this.db
      .prepare('SELECT payload_json FROM validations WHERE match_id = ? ORDER BY created_at ASC')
      .all(matchId);

    return rows.map((row) => parseJson(row.payload_json, null)).filter(Boolean);
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

    this.db.prepare(`
      INSERT INTO bag_items (id, user_id, created_at, payload_json)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, record.createdAt, JSON.stringify(record));

    return record;
  }

  listBagItems(userId) {
    const rows = this.db
      .prepare('SELECT payload_json FROM bag_items WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    return rows.map((row) => parseJson(row.payload_json, null)).filter(Boolean);
  }

  upsertPairRating(pairKey, rating) {
    this.db.prepare(`
      INSERT INTO pairs (pair_key, rating, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(pair_key) DO UPDATE SET
        rating = excluded.rating,
        updated_at = excluded.updated_at
    `).run(pairKey, Number(rating), nowIso());
  }

  getPairRating(pairKey) {
    const row = this.db.prepare('SELECT rating FROM pairs WHERE pair_key = ? LIMIT 1').get(pairKey);
    return row ? Number(row.rating) : null;
  }

  addMarketplaceListing(payload) {
    const id = newId('mkp');
    const record = {
      id,
      createdAt: nowIso(),
      status: 'active',
      ...payload,
    };

    this.db.prepare(`
      INSERT INTO marketplace (id, status, city_lower, category, created_at, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      record.status,
      record.city ? lower(record.city) : null,
      record.category ?? null,
      record.createdAt,
      JSON.stringify(record),
    );

    return record;
  }

  listMarketplace({ city, category } = {}) {
    const rows = this.db
      .prepare('SELECT payload_json FROM marketplace WHERE status = ? ORDER BY created_at DESC')
      .all('active');

    return rows
      .map((row) => parseJson(row.payload_json, null))
      .filter((item) => {
        if (!item) {
          return false;
        }
        if (city && lower(item.city) !== lower(city)) {
          return false;
        }
        if (category && item.category !== category) {
          return false;
        }
        return item.status === 'active';
      });
  }

  setLeaderboard(city, rows) {
    this.db.prepare(`
      INSERT INTO leaderboard_cache (city_lower, rows_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(city_lower) DO UPDATE SET
        rows_json = excluded.rows_json,
        updated_at = excluded.updated_at
    `).run(lower(city), JSON.stringify(rows ?? []), nowIso());
  }

  getLeaderboard(city) {
    const row = this.db
      .prepare('SELECT rows_json FROM leaderboard_cache WHERE city_lower = ? LIMIT 1')
      .get(lower(city));
    return parseJson(row?.rows_json, []);
  }

  listChannelMessages(channel, limit = 40) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 40));
    const rows = this.db.prepare(`
      SELECT payload_json FROM messages
      WHERE kind = 'channel' AND scope_key = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(channel, safeLimit);

    return rows
      .map((row) => parseJson(row.payload_json, null))
      .filter(Boolean)
      .reverse();
  }

  addChannelMessage(message) {
    this.db.prepare(`
      INSERT INTO messages (id, kind, scope_key, created_at, payload_json)
      VALUES (?, 'channel', ?, ?, ?)
    `).run(message.id, message.channel, message.createdAt, JSON.stringify(message));
    return message;
  }

  listPrivateMessages(userId, friendId, limit = 60) {
    const safeLimit = Math.max(1, Math.min(150, Number(limit) || 60));
    const scopeKey = stablePairKey(userId, friendId);
    const rows = this.db.prepare(`
      SELECT payload_json FROM messages
      WHERE kind = 'dm' AND scope_key = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(scopeKey, safeLimit);

    return rows
      .map((row) => parseJson(row.payload_json, null))
      .filter(Boolean)
      .reverse();
  }

  addPrivateMessage(message) {
    const scopeKey = stablePairKey(message.fromUserId, message.toUserId);
    this.db.prepare(`
      INSERT INTO messages (id, kind, scope_key, created_at, payload_json)
      VALUES (?, 'dm', ?, ?, ?)
    `).run(message.id, scopeKey, message.createdAt, JSON.stringify(message));
    return message;
  }

  listClubs({ city } = {}) {
    let rows = this.db.prepare('SELECT key, title, city, join_code AS joinCode FROM clubs').all();
    if (city) {
      const cityLower = lower(city);
      rows = rows.filter((club) => lower(club.city) === cityLower);
    }
    return rows;
  }

  getClubByJoinCode(code) {
    const row = this.db
      .prepare('SELECT key, title, city, join_code AS joinCode FROM clubs WHERE join_code_lower = ? LIMIT 1')
      .get(lower(code));
    return row ?? null;
  }

  getClubByKey(key) {
    const row = this.db
      .prepare('SELECT key, title, city, join_code AS joinCode FROM clubs WHERE key = ? LIMIT 1')
      .get(key);
    return row ?? null;
  }

  unlockBadge(userId, badgeKey, meta = {}) {
    const current = this.db
      .prepare('SELECT id, user_id AS userId, badge_key AS badgeKey, unlocked_at AS unlockedAt, meta_json FROM badges WHERE user_id = ? AND badge_key = ? LIMIT 1')
      .get(userId, badgeKey);

    if (current) {
      return {
        id: current.id,
        userId: current.userId,
        badgeKey: current.badgeKey,
        unlockedAt: current.unlockedAt,
        meta: parseJson(current.meta_json, {}),
        created: false,
      };
    }

    const id = newId('bdg');
    const unlockedAt = nowIso();
    this.db.prepare(`
      INSERT INTO badges (id, user_id, badge_key, unlocked_at, meta_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, userId, badgeKey, unlockedAt, JSON.stringify(meta ?? {}));

    return {
      id,
      userId,
      badgeKey,
      unlockedAt,
      meta,
      created: true,
    };
  }

  listBadgesForUser(userId) {
    const rows = this.db.prepare(`
      SELECT id, user_id AS userId, badge_key AS badgeKey, unlocked_at AS unlockedAt, meta_json
      FROM badges
      WHERE user_id = ?
      ORDER BY unlocked_at DESC
    `).all(userId);

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      badgeKey: row.badgeKey,
      unlockedAt: row.unlockedAt,
      meta: parseJson(row.meta_json, {}),
    }));
  }
}
