import { store } from '../store/index.js';
import { softReset } from '../domain/pir.js';

const DEFAULT_CITY = 'Lyon';
const HISTORY_LIMIT = 6;

function lower(text) {
  return String(text ?? '').trim().toLowerCase();
}

function quarterFromMonth(monthIndex) {
  return Math.floor(monthIndex / 3) + 1;
}

function seasonFromDate(date = new Date()) {
  const safe = Number.isNaN(new Date(date).getTime()) ? new Date() : new Date(date);
  const year = safe.getFullYear();
  const quarter = quarterFromMonth(safe.getMonth());
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  const nextStart = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);

  return {
    key: `${year}-S${quarter}`,
    label: `S${quarter} ${year}`,
    year,
    quarter,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    nextStartAt: nextStart.toISOString(),
  };
}

function seasonFromKey(key) {
  const raw = String(key ?? '').trim();
  const match = raw.match(/^(\d{4})-S([1-4])$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  const nextStart = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);
  return {
    key: raw,
    label: `S${quarter} ${year}`,
    year,
    quarter,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    nextStartAt: nextStart.toISOString(),
  };
}

function listPreviousSeasonKeys(fromKey, count = HISTORY_LIMIT) {
  const current = seasonFromKey(fromKey);
  if (!current) {
    return [];
  }
  const keys = [];
  let year = current.year;
  let quarter = current.quarter - 1;

  while (keys.length < count) {
    if (quarter <= 0) {
      year -= 1;
      quarter = 4;
    }
    keys.push(`${year}-S${quarter}`);
    quarter -= 1;
  }
  return keys;
}

function rankingWindow(period) {
  const startMs = new Date(period.startAt).getTime();
  const endMs = new Date(period.endAt).getTime();
  return {
    startMs: Number.isNaN(startMs) ? 0 : startMs,
    endMs: Number.isNaN(endMs) ? Date.now() : endMs,
  };
}

function calculateRows(users, period) {
  const { startMs, endMs } = rankingWindow(period);
  const rows = users.map((user) => {
    const scoped = (user.history ?? []).filter((entry) => {
      const at = new Date(entry.at ?? '').getTime();
      if (Number.isNaN(at)) {
        return false;
      }
      return at >= startMs && at <= endMs;
    });
    const periodPoints = scoped.reduce((sum, entry) => sum + Number(entry.delta ?? 0), 0);
    const wins = scoped.filter((entry) => Number(entry.delta ?? 0) > 0).length;
    const losses = scoped.length - wins;
    const recentMomentum = scoped.slice(-5).reduce((sum, entry) => sum + Number(entry.delta ?? 0), 0);
    const rankingScore = Number((user.rating + periodPoints * 11 + wins * 16 - losses * 5 + recentMomentum).toFixed(2));

    return {
      userId: user.id,
      displayName: user.displayName,
      city: user.city ?? null,
      rating: Number(user.rating ?? 0),
      pir: Number(user.pir ?? 0),
      periodPoints: Number(periodPoints.toFixed(2)),
      wins,
      losses,
      rankingScore,
    };
  }).sort((a, b) => b.rankingScore - a.rankingScore)
    .slice(0, 100)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return rows;
}

function seasonProgress(now, currentSeason) {
  const start = new Date(currentSeason.startAt).getTime();
  const end = new Date(currentSeason.endAt).getTime();
  const currentMs = now.getTime();
  const total = Math.max(1, end - start);
  const elapsed = Math.max(0, Math.min(total, currentMs - start));
  const daysRemaining = Math.max(0, Math.ceil((end - currentMs) / (1000 * 60 * 60 * 24)));
  return {
    progress: Number((elapsed / total).toFixed(4)),
    daysRemaining,
  };
}

function seasonBadgeFromRank(rank) {
  if (!Number.isFinite(rank) || rank < 1) {
    return null;
  }
  if (rank === 1) return 'City Champion';
  if (rank <= 3) return 'Season Podium';
  if (rank <= 10) return 'Top 10 Season';
  return null;
}

async function setSeasonState(state) {
  if (typeof store.setSeasonState === 'function') {
    await store.setSeasonState(state);
  }
}

async function getSeasonState() {
  if (typeof store.getSeasonState === 'function') {
    return store.getSeasonState();
  }
  return null;
}

async function archiveSeasonLeaderboard(seasonKey, city, rows, meta = {}) {
  if (typeof store.archiveSeasonLeaderboard === 'function') {
    await store.archiveSeasonLeaderboard(seasonKey, city, rows, meta);
  }
}

async function getArchivedSeasonLeaderboard(seasonKey, city) {
  if (typeof store.getSeasonLeaderboardArchive === 'function') {
    return store.getSeasonLeaderboardArchive(seasonKey, city);
  }
  return [];
}

async function archiveSeasonIfNeeded(previousSeasonKey) {
  const previous = seasonFromKey(previousSeasonKey);
  if (!previous) {
    return;
  }

  const users = await store.listUsers();
  const cities = [...new Set(users
    .map((user) => String(user.city ?? '').trim())
    .filter(Boolean))];

  for (const city of cities) {
    const scopedUsers = users.filter((user) => lower(user.city) === lower(city));
    const rows = calculateRows(scopedUsers, previous);
    await archiveSeasonLeaderboard(previous.key, city, rows, {
      label: previous.label,
      startAt: previous.startAt,
      endAt: previous.endAt,
      city,
      archivedFrom: 'season_transition',
    });
  }
}

async function applySoftResetForNewSeason() {
  const users = await store.listUsers();
  for (const user of users) {
    const nextRating = softReset(user.rating);
    const pir = Number(user.pir ?? 50);
    const nextPir = Number((50 + (pir - 50) * 0.45).toFixed(2));
    await store.updateUser(user.id, {
      rating: nextRating,
      pir: nextPir,
    });
  }
}

export async function ensureSeasonTransition() {
  const now = new Date();
  const current = seasonFromDate(now);
  const state = await getSeasonState();

  if (!state?.currentSeasonKey) {
    await setSeasonState({
      currentSeasonKey: current.key,
      transitionedAt: now.toISOString(),
    });
    return current;
  }

  if (state.currentSeasonKey === current.key) {
    return current;
  }

  await archiveSeasonIfNeeded(state.currentSeasonKey);
  await applySoftResetForNewSeason();
  await setSeasonState({
    currentSeasonKey: current.key,
    transitionedAt: now.toISOString(),
    previousSeasonKey: state.currentSeasonKey,
  });

  return current;
}

export async function getSeasonLeaderboard({ city, seasonKey, limit = 20 } = {}) {
  await ensureSeasonTransition();
  const targetCity = String(city ?? DEFAULT_CITY).trim() || DEFAULT_CITY;
  const current = seasonFromDate(new Date());
  const targetSeason = seasonFromKey(seasonKey ?? current.key) ?? current;

  if (targetSeason.key !== current.key) {
    const archived = await getArchivedSeasonLeaderboard(targetSeason.key, targetCity);
    return {
      city: targetCity,
      seasonKey: targetSeason.key,
      seasonLabel: targetSeason.label,
      startAt: targetSeason.startAt,
      endAt: targetSeason.endAt,
      generatedAt: new Date().toISOString(),
      rows: archived.slice(0, Math.max(5, Math.min(100, Number(limit) || 20))),
      archived: true,
    };
  }

  const users = (await store.listUsers())
    .filter((user) => lower(user.city ?? DEFAULT_CITY) === lower(targetCity));
  const rows = calculateRows(users, targetSeason).slice(0, Math.max(5, Math.min(100, Number(limit) || 20)));
  return {
    city: targetCity,
    seasonKey: targetSeason.key,
    seasonLabel: targetSeason.label,
    startAt: targetSeason.startAt,
    endAt: targetSeason.endAt,
    generatedAt: new Date().toISOString(),
    rows,
    archived: false,
  };
}

export async function getSeasonsOverview({ userId, city } = {}) {
  const now = new Date();
  const current = await ensureSeasonTransition();
  const progress = seasonProgress(now, current);
  const user = userId ? await store.getUserById(userId) : null;
  const resolvedCity = String(city ?? user?.city ?? DEFAULT_CITY).trim() || DEFAULT_CITY;
  const previousKeys = listPreviousSeasonKeys(current.key, HISTORY_LIMIT);

  const history = [];
  for (const key of previousKeys) {
    const season = seasonFromKey(key);
    if (!season) {
      continue;
    }
    const rows = await getArchivedSeasonLeaderboard(key, resolvedCity);
    const userRank = userId ? rows.find((item) => item.userId === userId)?.rank ?? null : null;
    history.push({
      key: season.key,
      label: season.label,
      startAt: season.startAt,
      endAt: season.endAt,
      city: resolvedCity,
      rowsCount: rows.length,
      userRank,
      rewardBadge: seasonBadgeFromRank(userRank),
      archived: rows.length > 0,
    });
  }

  const currentBoard = await getSeasonLeaderboard({ city: resolvedCity, seasonKey: current.key, limit: 100 });
  const currentRank = userId ? currentBoard.rows.find((item) => item.userId === userId)?.rank ?? null : null;

  return {
    now: now.toISOString(),
    city: resolvedCity,
    current: {
      ...current,
      progress: progress.progress,
      daysRemaining: progress.daysRemaining,
      userRank: currentRank,
    },
    history,
    nextSeasonStartsAt: current.nextStartAt,
  };
}

export function seasonLabelForDate(date = new Date()) {
  return seasonFromDate(date).label;
}

export function seasonRangeForDate(date = new Date()) {
  const season = seasonFromDate(date);
  return {
    key: season.key,
    label: season.label,
    startAt: season.startAt,
    endAt: season.endAt,
  };
}
