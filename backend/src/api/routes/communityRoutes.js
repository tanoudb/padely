import { json, readJson } from '../http.js';
import { requireAuth } from '../auth.js';
import {
  addFriend,
  connectByArcadeTag,
  createCustomChannel,
  findPlayerByArcadeTag,
  getBalancedProposals,
  getCityLeaderboard,
  getCrewOverview,
  getTemporalLeaderboard,
  getUnreadSummary,
  joinClubByCode,
  listChannelMessagesForUser,
  listPrivateMessagesForUser,
  markChannelRead,
  markPrivateRead,
  postChannelMessage,
  postPrivateMessage,
  searchPlayers,
  subscribeCommunityFeed,
} from '../../services/communityService.js';
import {
  getMatchmakingSuggestions,
  proposeMatchmakingInvite,
} from '../../services/matchmakingService.js';
import { getCommunityFeed } from '../../services/groupService.js';
import { exact, pattern } from './routeBuilder.js';
import {
  attachSseHeartbeat,
  maybeNumber,
  openSseStream,
  writeSseEvent,
} from './helpers.js';

export const communityRoutes = [
  exact('GET', '/api/v1/community/players', async ({ req, res, url }) => {
    await requireAuth(req);
    return json(res, 200, await searchPlayers({
      ratingMin: Number(url.searchParams.get('ratingMin') ?? 0),
      ratingMax: Number(url.searchParams.get('ratingMax') ?? 9999),
      lat: maybeNumber(url.searchParams.get('lat')),
      lng: maybeNumber(url.searchParams.get('lng')),
      radiusKm: Number(url.searchParams.get('radiusKm') ?? 25),
    }));
  }),
  exact('GET', '/api/v1/community/matchmaking/suggestions', async ({ req, res, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getMatchmakingSuggestions(me.id, {
      city: url.searchParams.get('city') ?? undefined,
      limit: maybeNumber(url.searchParams.get('limit')),
    }));
  }),
  exact('POST', '/api/v1/community/matchmaking/propose', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await proposeMatchmakingInvite({
      fromUserId: me.id,
      targetUserId: payload.targetUserId,
      message: payload.message,
    }));
  }),
  exact('GET', '/api/v1/community/crew', async ({ req, res, url }) => {
    const me = await requireAuth(req);
    const city = url.searchParams.get('city') ?? undefined;
    return json(res, 200, await getCrewOverview(me.id, city));
  }),
  exact('GET', '/api/v1/community/feed', async ({ req, res, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getCommunityFeed(me.id, {
      limit: maybeNumber(url.searchParams.get('limit')),
    }));
  }),
  exact('GET', '/api/v1/community/unread', async ({ req, res }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getUnreadSummary(me.id));
  }),
  exact('GET', '/api/v1/community/live', async ({ req, res }) => {
    const me = await requireAuth(req);
    openSseStream(res);

    const unsubscribe = subscribeCommunityFeed({
      userId: me.id,
      onEvent: ({ event, data }) => writeSseEvent(res, event, data),
    });

    attachSseHeartbeat(req, res, unsubscribe);
  }),
  exact('POST', '/api/v1/community/friends', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await addFriend(me.id, payload.friendId));
  }),
  exact('POST', '/api/v1/community/channels', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await createCustomChannel(me.id, payload.name));
  }),
  exact('POST', '/api/v1/community/clubs/join', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await joinClubByCode(me.id, payload.code));
  }),
  pattern('GET', '/api/v1/community/messages/:friendId', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    const friendId = decodeURIComponent(params.friendId);
    const out = await listPrivateMessagesForUser(me.id, friendId, {
      limit: maybeNumber(url.searchParams.get('limit')),
      before: url.searchParams.get('before') ?? undefined,
      markRead: url.searchParams.get('markRead') === '1',
    });
    return json(res, 200, out);
  }),
  pattern('POST', '/api/v1/community/messages/:friendId', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await postPrivateMessage({
      fromUserId: me.id,
      toUserId: decodeURIComponent(params.friendId),
      text: payload.text,
    }));
  }),
  pattern('POST', '/api/v1/community/messages/:friendId/read', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await markPrivateRead(
      me.id,
      decodeURIComponent(params.friendId),
      payload.readAt ?? new Date().toISOString(),
    ));
  }),
  pattern('GET', '/api/v1/community/channels/:channel/messages', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    const out = await listChannelMessagesForUser(me.id, decodeURIComponent(params.channel), {
      limit: maybeNumber(url.searchParams.get('limit')),
      before: url.searchParams.get('before') ?? undefined,
      markRead: url.searchParams.get('markRead') === '1',
    });
    return json(res, 200, out);
  }),
  pattern('POST', '/api/v1/community/channels/:channel/messages', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await postChannelMessage({
      userId: me.id,
      channel: decodeURIComponent(params.channel),
      text: payload.text,
    }));
  }),
  pattern('POST', '/api/v1/community/channels/:channel/read', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await markChannelRead(
      me.id,
      decodeURIComponent(params.channel),
      payload.readAt ?? new Date().toISOString(),
    ));
  }),
  exact('GET', '/api/v1/community/leaderboard', async ({ req, res, url }) => {
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
  }),
  exact('GET', '/api/v1/community/leaderboard/periods', async ({ req, res, url }) => {
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
  }),
  exact('GET', '/api/v1/community/arcade/search', async ({ req, res, url }) => {
    await requireAuth(req);
    const tag = url.searchParams.get('tag') ?? '';
    return json(res, 200, await findPlayerByArcadeTag(tag));
  }),
  exact('POST', '/api/v1/community/arcade/connect', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await connectByArcadeTag(me.id, payload.tag));
  }),
  exact('POST', '/api/v1/community/matchmaking', async ({ req, res }) => {
    await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await getBalancedProposals(payload.players ?? [], payload.maxResults ?? 5));
  }),
];
