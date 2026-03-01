import http from 'node:http';
import { HttpError, json, readJson } from './api/http.js';
import { parseUrl, pathMatch } from './api/router.js';
import { requireAdmin, requireAuth } from './api/auth.js';
import { evaluateMatch } from './engine/matchEngine.js';
import { findBalancedMatches } from './engine/matchmaking.js';
import {
  loginWithEmail,
  loginWithProvider,
  registerWithEmail,
  resendEmailVerificationCode,
  verifyEmailCode,
  verifyEmailToken,
} from './services/authService.js';
import {
  addFriend,
  createCustomChannel,
  getCrewOverview,
  getBalancedProposals,
  getCityLeaderboard,
  getTemporalLeaderboard,
  findPlayerByArcadeTag,
  connectByArcadeTag,
  joinClubByCode,
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
  updatePushToken,
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
const host = process.env.HOST ?? '0.0.0.0';
const RATE_LIMIT_WINDOW_MS = Math.max(5_000, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000));
const RATE_LIMIT_MAX = Math.max(20, Number(process.env.RATE_LIMIT_MAX ?? 180));
const rateBuckets = new Map();
await seedDemoData();

function maybeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getClientKey(req) {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

function enforceRateLimit(req, pathname) {
  if (!pathname.startsWith('/api/')) {
    return;
  }
  const now = Date.now();
  const key = `${getClientKey(req)}:${pathname}`;
  const current = rateBuckets.get(key) ?? { count: 0, windowStart: now };

  if (now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    current.count = 0;
    current.windowStart = now;
  }
  current.count += 1;
  rateBuckets.set(key, current);

  if (current.count > RATE_LIMIT_MAX) {
    throw new HttpError(429, 'Rate limit exceeded');
  }
}

function inferStatusCode(error) {
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600) {
    return error.statusCode;
  }
  const msg = String(error?.message ?? '').toLowerCase();
  if (msg.includes('auth token')) return 401;
  if (msg.includes('admin access')) return 403;
  if (msg.includes('not found')) return 404;
  if (
    msg.includes('invalid')
    || msg.includes('required')
    || msg.includes('exists')
    || msg.includes('expired')
    || msg.includes('empty')
    || msg.includes('missing')
  ) {
    return 400;
  }
  return 500;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = parseUrl(req);
    enforceRateLimit(req, url.pathname);

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
      if (payload.token) {
        return json(res, 200, await verifyEmailToken(payload.token));
      }
      return json(res, 200, await verifyEmailCode({
        email: payload.email,
        code: payload.code,
      }));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/verify/resend') {
      const payload = await readJson(req);
      return json(res, 200, await resendEmailVerificationCode({
        email: payload.email,
      }));
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

    if (req.method === 'PUT' && url.pathname === '/api/v1/profile/push-token') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await updatePushToken(me.id, payload));
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

    if (req.method === 'POST' && url.pathname === '/api/v1/community/channels') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 201, await createCustomChannel(me.id, payload.name));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/community/clubs/join') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await joinClubByCode(me.id, payload.code));
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
      const period = url.searchParams.get('period') ?? 'all';
      if (period === 'all') {
        return json(res, 200, {
          city,
          period,
          rows: await getCityLeaderboard(city),
          rewards: [{ rank: 1, reward: 'Hall of fame Padely' }],
        });
      }
      return json(res, 200, await getTemporalLeaderboard({ city, period }));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/leaderboard/periods') {
      await requireAuth(req);
      const city = url.searchParams.get('city') ?? 'lyon';
      const [day, week, month, all] = await Promise.all([
        getTemporalLeaderboard({ city, period: 'day' }),
        getTemporalLeaderboard({ city, period: 'week' }),
        getTemporalLeaderboard({ city, period: 'month' }),
        getTemporalLeaderboard({ city, period: 'all' }),
      ]);
      return json(res, 200, { city, day, week, month, all });
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/arcade/search') {
      await requireAuth(req);
      const tag = url.searchParams.get('tag') ?? '';
      return json(res, 200, await findPlayerByArcadeTag(tag));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/community/arcade/connect') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, await connectByArcadeTag(me.id, payload.tag));
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
      await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 200, evaluateMatch(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/matchmaking') {
      await requireAuth(req);
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
      await requireAdmin(req);
      const payload = await readJson(req);
      const city = payload.city ?? 'lyon';
      return json(res, 200, await refreshCityLeaderboard(city));
    }

    return json(res, 404, {
      error: 'Not found',
      path: req.url,
    });
  } catch (error) {
    const statusCode = inferStatusCode(error);
    if (statusCode >= 500) {
      console.error('[api-error]', error);
    }
    return json(res, statusCode, {
      error: statusCode >= 500 ? 'Internal server error' : (error.publicMessage ?? error.message),
    });
  }
});

server.listen(port, host, () => {
  console.log(`Padely API listening on http://${host}:${port} (storage=${storageProvider})`);
});
