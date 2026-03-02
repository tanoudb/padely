import { json, readJson } from '../http.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { evaluateMatch } from '../../engine/matchEngine.js';
import { findBalancedMatches } from '../../engine/matchmaking.js';
import {
  evaluateBadges,
  getBadgeGlobalStats,
  runInactivityDecay,
  runSeasonSoftReset,
} from '../../services/gamificationService.js';
import { getSeasonsOverview } from '../../services/seasonService.js';
import { refreshCityLeaderboard } from '../../services/communityService.js';
import { exact, pattern } from './routeBuilder.js';

export const gamificationPirAdminRoutes = [
  pattern('GET', '/api/v1/gamification/seasons', async ({ req, res, url }) => {
    const me = await requireAuth(req);
    const city = url.searchParams.get('city') ?? me.city ?? 'Lyon';
    return json(res, 200, await getSeasonsOverview({ userId: me.id, city }));
  }),
  exact('GET', '/api/v1/gamification/badges/stats', async ({ req, res }) => {
    await requireAuth(req);
    return json(res, 200, await getBadgeGlobalStats());
  }),
  pattern('GET', '/api/v1/gamification/badges/:userId', async ({ req, res, params }) => {
    await requireAuth(req);
    return json(res, 200, await evaluateBadges(params.userId));
  }),
  exact('POST', '/api/v1/gamification/season-reset', async ({ req, res }) => {
    await requireAuth(req);
    return json(res, 200, await runSeasonSoftReset());
  }),
  exact('POST', '/api/v1/gamification/inactivity-decay', async ({ req, res }) => {
    await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await runInactivityDecay(payload.referenceDateIso));
  }),
  exact('POST', '/api/v1/pir/rate-match', async ({ req, res }) => {
    await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, evaluateMatch(payload));
  }),
  exact('POST', '/api/v1/matchmaking', async ({ req, res }) => {
    await requireAuth(req);
    const payload = await readJson(req);
    const results = findBalancedMatches(payload.players ?? [], {
      maxResults: payload.maxResults ?? 5,
    });
    return json(res, 200, {
      count: results.length,
      results,
    });
  }),
  exact('POST', '/api/v1/admin/leaderboard/refresh', async ({ req, res }) => {
    await requireAdmin(req);
    const payload = await readJson(req);
    const city = payload.city ?? 'lyon';
    return json(res, 200, await refreshCityLeaderboard(city));
  }),
];
