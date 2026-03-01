import http from 'node:http';
import { json, readJson } from './api/http.js';
import { parseUrl, pathMatch } from './api/router.js';
import { requireAuth } from './api/auth.js';
import { evaluateMatch } from './engine/matchEngine.js';
import { findBalancedMatches } from './engine/matchmaking.js';
import {
  loginWithEmail,
  loginWithProvider,
  registerWithEmail,
  verifyEmailToken,
} from './services/authService.js';
import {
  addFriend,
  getCrewOverview,
  getBalancedProposals,
  getCityLeaderboard,
  listChannelMessages,
  listPrivateMessages,
  postChannelMessage,
  postPrivateMessage,
  refreshCityLeaderboard,
  searchPlayers,
} from './services/communityService.js';
import {
  evaluateBadges,
  runInactivityDecay,
  runSeasonSoftReset,
} from './services/gamificationService.js';
import { createListing, listListings } from './services/marketplaceService.js';
import {
  createMatch,
  createPostMatchInvite,
  getMatch,
  listMatchesForUser,
  validateMatch,
} from './services/matchService.js';
import {
  completeOnboarding,
  getProfile,
  updateAthleteProfile,
  updateUserSettings,
} from './services/profileService.js';
import {
  getDashboard,
  getDuoStats,
  getPerformanceHoles,
} from './services/statsService.js';
import { seedDemoData } from './store/seed.js';
import { storageProvider } from './store/index.js';

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
const host = process.env.HOST ?? '127.0.0.1';
await seedDemoData();

function maybeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = parseUrl(req);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        status: 'ok',
        service: 'padely-api',
        storageProvider,
        time: new Date().toISOString(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/register') {
      const payload = await readJson(req);
      return json(res, 201, await registerWithEmail(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      const payload = await readJson(req);
      return json(res, 200, await loginWithEmail(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/oauth/google') {
      const payload = await readJson(req);
      return json(res, 200, await loginWithProvider({ ...payload, provider: 'google' }));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/oauth/apple') {
      const payload = await readJson(req);
      return json(res, 200, await loginWithProvider({ ...payload, provider: 'apple' }));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/auth/verify') {
      const token = url.searchParams.get('token');
      return json(res, 200, await verifyEmailToken(token));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/verify') {
      const payload = await readJson(req);
      return json(res, 200, await verifyEmailToken(payload.token));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/me') {
      const me = await requireAuth(req);
      return json(res, 200, me);
    }

    if (req.method === 'PUT' && url.pathname === '/api/v1/profile/athlete') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await updateAthleteProfile(me.id, payload));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/profile') {
      const me = await requireAuth(req);
      return json(res, 200, await getProfile(me.id));
    }

    if (req.method === 'PUT' && url.pathname === '/api/v1/profile/onboarding') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await completeOnboarding(me.id, payload));
    }

    if (req.method === 'PUT' && url.pathname === '/api/v1/profile/settings') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await updateUserSettings(me.id, payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/matches') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 201, await createMatch(payload, me.id));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/matches') {
      const me = await requireAuth(req);
      return json(res, 200, await listMatchesForUser(me.id, {
        status: url.searchParams.get('status') ?? undefined,
      }));
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/matches/:matchId');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await getMatch(params.matchId));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/matches/:matchId/validate');
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 200, await validateMatch({
          matchId: params.matchId,
          userId: me.id,
          accepted: payload.accepted,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/matches/:matchId/invite');
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await createPostMatchInvite(params.matchId, me.id));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/dashboard/:userId');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await getDashboard(params.userId));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/duo/:userId');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await getDuoStats(params.userId));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/performance-holes/:userId');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await getPerformanceHoles(params.userId));
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/players') {
      await requireAuth(req);
      return json(res, 200, await searchPlayers({
        ratingMin: Number(url.searchParams.get('ratingMin') ?? 0),
        ratingMax: Number(url.searchParams.get('ratingMax') ?? 9999),
        lat: maybeNumber(url.searchParams.get('lat')),
        lng: maybeNumber(url.searchParams.get('lng')),
        radiusKm: Number(url.searchParams.get('radiusKm') ?? 25),
      }));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/crew') {
      const me = await requireAuth(req);
      const city = url.searchParams.get('city') ?? undefined;
      return json(res, 200, await getCrewOverview(me.id, city));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/community/friends') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await addFriend(me.id, payload.friendId));
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/community/messages/:friendId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await listPrivateMessages(me.id, decodeURIComponent(params.friendId)));
      }
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 201, await postPrivateMessage({
          fromUserId: me.id,
          toUserId: decodeURIComponent(params.friendId),
          text: payload.text,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/community/channels/:channel/messages');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await listChannelMessages(decodeURIComponent(params.channel)));
      }
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 201, await postChannelMessage({
          userId: me.id,
          channel: decodeURIComponent(params.channel),
          text: payload.text,
        }));
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/leaderboard') {
      await requireAuth(req);
      const city = url.searchParams.get('city') ?? 'lyon';
      return json(res, 200, {
        city,
        rows: await getCityLeaderboard(city),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/community/matchmaking') {
      await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await getBalancedProposals(payload.players ?? [], payload.maxResults ?? 5));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/marketplace/listings') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 201, await createListing(me.id, payload));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/marketplace/listings') {
      await requireAuth(req);
      return json(res, 200, await listListings({
        city: url.searchParams.get('city') ?? undefined,
        category: url.searchParams.get('category') ?? undefined,
      }));
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/gamification/badges/:userId');
      if (req.method === 'GET' && params) {
        await requireAuth(req);
        return json(res, 200, await evaluateBadges(params.userId));
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/gamification/season-reset') {
      await requireAuth(req);
      return json(res, 200, await runSeasonSoftReset());
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/gamification/inactivity-decay') {
      await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await runInactivityDecay(payload.referenceDateIso));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/pir/rate-match') {
      const payload = await readJson(req);
      return json(res, 200, evaluateMatch(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/matchmaking') {
      const payload = await readJson(req);
      const results = findBalancedMatches(payload.players ?? [], {
        maxResults: payload.maxResults ?? 5,
      });
      return json(res, 200, {
        count: results.length,
        results,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/admin/leaderboard/refresh') {
      await requireAuth(req);
      const payload = await readJson(req);
      const city = payload.city ?? 'lyon';
      return json(res, 200, await refreshCityLeaderboard(city));
    }

    return json(res, 404, {
      error: 'Not found',
      path: req.url,
    });
  } catch (error) {
    return json(res, 400, {
      error: error.message,
    });
  }
});

server.listen(port, host, () => {
  console.log(`Padely API listening on http://${host}:${port} (storage=${storageProvider})`);
});
