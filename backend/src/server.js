import http from 'node:http';
import { HttpError, json, readJson } from './api/http.js';
import { createRateLimiter } from './api/rateLimit.js';
import { parseUrl, pathMatch } from './api/router.js';
import {
  RequestValidationError,
  validateCreateMatchPayload,
  validateLoginPayload,
  validateMatchDecisionPayload,
  validateRegisterPayload,
  validateUpdateProfilePayload,
} from './api/validation.js';
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
  getUnreadSummary,
  getCrewOverview,
  getBalancedProposals,
  getCityLeaderboard,
  getTemporalLeaderboard,
  findPlayerByArcadeTag,
  connectByArcadeTag,
  joinClubByCode,
  listChannelMessagesForUser,
  listPrivateMessagesForUser,
  markChannelRead,
  markPrivateRead,
  postChannelMessage,
  postPrivateMessage,
  refreshCityLeaderboard,
  searchPlayers,
  subscribeCommunityFeed,
} from './services/communityService.js';
import {
  evaluateBadges,
  runInactivityDecay,
  runSeasonSoftReset,
} from './services/gamificationService.js';
import { getSeasonsOverview } from './services/seasonService.js';
import { createListing, listListings } from './services/marketplaceService.js';
import {
  createMatch,
  createPostMatchInvite,
  getMatch,
  listMatchesForUser,
  validateMatch,
} from './services/matchService.js';
import {
  closeLiveMatchSession,
  getLiveMatchState,
  pushLiveScoreUpdate,
  startLiveMatchSession,
  subscribeLiveMatch,
} from './services/liveMatchService.js';
import {
  completeOnboarding,
  getProfile,
  updatePushToken,
  updateAthleteProfile,
  updateUserSettings,
} from './services/profileService.js';
import {
  getDashboard,
  getHeadToHead,
  getDuoStats,
  getPerformanceHoles,
  getPublicPlayerProfile,
  getRecords,
} from './services/statsService.js';
import { seedDemoData } from './store/seed.js';
import { storageProvider } from './store/index.js';

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
const host = process.env.HOST ?? '0.0.0.0';
const RATE_LIMIT_WINDOW_MS = Math.max(5_000, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000));
const RATE_LIMIT_MAX = Math.max(20, Number(process.env.RATE_LIMIT_MAX ?? 180));
const AUTH_RATE_LIMIT_WINDOW_MS = Math.max(5_000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000));
const AUTH_RATE_LIMIT_MAX = Math.max(1, Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5));
const authAttemptPaths = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/oauth/google',
  '/api/v1/auth/oauth/apple',
]);
const globalRateLimiter = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
});
const authRateLimiter = createRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: 'Trop de tentatives auth. Reessaye dans 1 minute.',
});
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

  const ipKey = getClientKey(req);
  globalRateLimiter.consume(`${ipKey}:${pathname}`);

  const isAuthAttempt = req.method === 'POST' && authAttemptPaths.has(pathname);
  if (isAuthAttempt) {
    authRateLimiter.consume(ipKey);
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

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
      const payload = validateRegisterPayload(await readJson(req));
      return json(res, 201, await registerWithEmail(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      const payload = validateLoginPayload(await readJson(req));
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
      const payload = validateUpdateProfilePayload(await readJson(req));
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
      const payload = validateCreateMatchPayload(await readJson(req));
      return json(res, 201, await createMatch(payload, me.id));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/matches/live') {
      const me = await requireAuth(req);
      const payload = await readJson(req);
      return json(res, 201, startLiveMatchSession({
        createdBy: me.id,
        participants: payload.participants ?? [],
        initialScoreState: payload.scoreState ?? {},
        metadata: payload.metadata ?? {},
      }));
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/matches/:matchId/live/state');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, getLiveMatchState({
          matchId: params.matchId,
          userId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/matches/:matchId/live');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        getLiveMatchState({
          matchId: params.matchId,
          userId: me.id,
        });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const unsubscribe = subscribeLiveMatch({
          matchId: params.matchId,
          userId: me.id,
          onEvent: ({ event, data }) => writeSseEvent(res, event, data),
        });

        const heartbeat = setInterval(() => {
          res.write(': heartbeat\n\n');
        }, 20_000);

        req.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
          res.end();
        });
        return undefined;
      }

      if (req.method === 'PUT' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 200, pushLiveScoreUpdate({
          matchId: params.matchId,
          userId: me.id,
          scoreState: payload.scoreState ?? {},
          actorDeviceId: payload.actorDeviceId,
        }));
      }

      if (req.method === 'DELETE' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 200, closeLiveMatchSession({
          matchId: params.matchId,
          userId: me.id,
          reason: payload.reason ?? 'manual_close',
          linkedMatchId: payload.linkedMatchId ?? null,
        }));
      }
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
        const payload = validateMatchDecisionPayload(await readJson(req));
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
        const me = await requireAuth(req);
        return json(res, 200, await getDashboard(params.userId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/duo/:userId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await getDuoStats(params.userId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/head-to-head/:userId/:opponentId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await getHeadToHead(params.userId, params.opponentId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/records/:userId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await getRecords(params.userId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/public-profile/:playerId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await getPublicPlayerProfile(params.playerId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/stats/performance-holes/:userId');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        return json(res, 200, await getPerformanceHoles(params.userId, {
          period: url.searchParams.get('period') ?? 'all',
          viewerId: me.id,
        }));
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

    if (req.method === 'GET' && url.pathname === '/api/v1/community/unread') {
      const me = await requireAuth(req);
      return json(res, 200, await getUnreadSummary(me.id));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/community/live') {
      const me = await requireAuth(req);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const unsubscribe = subscribeCommunityFeed({
        userId: me.id,
        onEvent: ({ event, data }) => writeSseEvent(res, event, data),
      });

      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 20_000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      });
      return undefined;
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
        const friendId = decodeURIComponent(params.friendId);
        const out = await listPrivateMessagesForUser(me.id, friendId, {
          limit: maybeNumber(url.searchParams.get('limit')),
          before: url.searchParams.get('before') ?? undefined,
          markRead: url.searchParams.get('markRead') === '1',
        });
        return json(res, 200, out);
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
      const params = pathMatch(url.pathname, '/api/v1/community/messages/:friendId/read');
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 200, await markPrivateRead(
          me.id,
          decodeURIComponent(params.friendId),
          payload.readAt ?? new Date().toISOString(),
        ));
      }
    }

    {
      const params = pathMatch(url.pathname, '/api/v1/community/channels/:channel/messages');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        const out = await listChannelMessagesForUser(me.id, decodeURIComponent(params.channel), {
          limit: maybeNumber(url.searchParams.get('limit')),
          before: url.searchParams.get('before') ?? undefined,
          markRead: url.searchParams.get('markRead') === '1',
        });
        return json(res, 200, out);
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

    {
      const params = pathMatch(url.pathname, '/api/v1/community/channels/:channel/read');
      if (req.method === 'POST' && params) {
        const me = await requireAuth(req);
        const payload = await readJson(req);
        return json(res, 200, await markChannelRead(
          me.id,
          decodeURIComponent(params.channel),
          payload.readAt ?? new Date().toISOString(),
        ));
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
      const [day, week, month, season, all] = await Promise.all([
        getTemporalLeaderboard({ city, period: 'day' }),
        getTemporalLeaderboard({ city, period: 'week' }),
        getTemporalLeaderboard({ city, period: 'month' }),
        getTemporalLeaderboard({ city, period: 'season' }),
        getTemporalLeaderboard({ city, period: 'all' }),
      ]);
      return json(res, 200, { city, day, week, month, season, all });
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
      const params = pathMatch(url.pathname, '/api/v1/gamification/seasons');
      if (req.method === 'GET' && params) {
        const me = await requireAuth(req);
        const city = url.searchParams.get('city') ?? me.city ?? 'Lyon';
        return json(res, 200, await getSeasonsOverview({ userId: me.id, city }));
      }
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
    if (error instanceof RequestValidationError) {
      return json(res, 400, {
        error: error.code,
        field: error.field,
        message: error.publicMessage,
        issues: error.issues,
      });
    }

    const statusCode = inferStatusCode(error);
    if (statusCode >= 500) {
      console.error('[api-error]', error);
    }

    const message = statusCode >= 500 ? 'Internal server error' : (error.publicMessage ?? error.message);
    if (statusCode === 429) {
      return json(res, statusCode, {
        error: 'rate_limit',
        message,
      });
    }

    return json(res, statusCode, {
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message,
    });
  }
});

server.listen(port, host, () => {
  console.log(`Padely API listening on http://${host}:${port} (storage=${storageProvider})`);
});
