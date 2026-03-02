import { json } from '../http.js';
import { requireAuth } from '../auth.js';
import {
  getDashboard,
  getHeadToHead,
  getDuoStats,
  getPerformanceHoles,
  getPublicPlayerProfile,
  getRecords,
} from '../../services/statsService.js';
import { pattern } from './routeBuilder.js';

export const statsRoutes = [
  pattern('GET', '/api/v1/stats/dashboard/:userId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getDashboard(params.userId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/stats/duo/:userId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getDuoStats(params.userId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/stats/head-to-head/:userId/:opponentId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getHeadToHead(params.userId, params.opponentId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/stats/records/:userId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getRecords(params.userId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/stats/public-profile/:playerId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getPublicPlayerProfile(params.playerId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/stats/performance-holes/:userId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getPerformanceHoles(params.userId, {
      period: url.searchParams.get('period') ?? 'all',
      viewerId: me.id,
    }));
  }),
];
