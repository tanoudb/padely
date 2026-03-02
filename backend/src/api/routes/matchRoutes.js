import { json, readJson } from '../http.js';
import { requireAuth } from '../auth.js';
import {
  validateCreateMatchPayload,
  validateMatchDecisionPayload,
} from '../validation.js';
import {
  createMatch,
  createPostMatchInvite,
  getMatch,
  listMatchesForUser,
  validateMatch,
} from '../../services/matchService.js';
import {
  closeLiveMatchSession,
  getLiveMatchState,
  pushLiveScoreUpdate,
  startLiveMatchSession,
  subscribeLiveMatch,
} from '../../services/liveMatchService.js';
import { exact, pattern } from './routeBuilder.js';
import {
  attachSseHeartbeat,
  openSseStream,
  writeSseEvent,
} from './helpers.js';

export const matchRoutes = [
  exact('POST', '/api/v1/matches', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = validateCreateMatchPayload(await readJson(req));
    return json(res, 201, await createMatch(payload, me.id));
  }),
  exact('POST', '/api/v1/matches/live', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, startLiveMatchSession({
      createdBy: me.id,
      participants: payload.participants ?? [],
      initialScoreState: payload.scoreState ?? {},
      metadata: payload.metadata ?? {},
    }));
  }),
  pattern('GET', '/api/v1/matches/:matchId/live/state', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    return json(res, 200, getLiveMatchState({
      matchId: params.matchId,
      userId: me.id,
    }));
  }),
  pattern('GET', '/api/v1/matches/:matchId/live', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    getLiveMatchState({
      matchId: params.matchId,
      userId: me.id,
    });

    openSseStream(res);
    const unsubscribe = subscribeLiveMatch({
      matchId: params.matchId,
      userId: me.id,
      onEvent: ({ event, data }) => writeSseEvent(res, event, data),
    });
    attachSseHeartbeat(req, res, unsubscribe);
  }),
  pattern('PUT', '/api/v1/matches/:matchId/live', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, pushLiveScoreUpdate({
      matchId: params.matchId,
      userId: me.id,
      scoreState: payload.scoreState ?? {},
      actorDeviceId: payload.actorDeviceId,
    }));
  }),
  pattern('DELETE', '/api/v1/matches/:matchId/live', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, closeLiveMatchSession({
      matchId: params.matchId,
      userId: me.id,
      reason: payload.reason ?? 'manual_close',
      linkedMatchId: payload.linkedMatchId ?? null,
    }));
  }),
  exact('GET', '/api/v1/matches', async ({ req, res, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await listMatchesForUser(me.id, {
      status: url.searchParams.get('status') ?? undefined,
    }));
  }),
  pattern('GET', '/api/v1/matches/:matchId', async ({ req, res, params }) => {
    await requireAuth(req);
    return json(res, 200, await getMatch(params.matchId));
  }),
  pattern('POST', '/api/v1/matches/:matchId/validate', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = validateMatchDecisionPayload(await readJson(req));
    return json(res, 200, await validateMatch({
      matchId: params.matchId,
      userId: me.id,
      accepted: payload.accepted,
    }));
  }),
  pattern('POST', '/api/v1/matches/:matchId/invite', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    return json(res, 200, await createPostMatchInvite(params.matchId, me.id));
  }),
];
