import { json, readJson } from '../http.js';
import { requireAuth } from '../auth.js';
import {
  addMembersToGroup,
  createGroup,
  joinGroup,
  joinGroupByCode,
  leaveGroup,
  listGroupMessages,
  listMyGroups,
  postGroupMessage,
} from '../../services/groupService.js';
import { createListing, listListings } from '../../services/marketplaceService.js';
import { exact, pattern } from './routeBuilder.js';
import { maybeNumber } from './helpers.js';

export const groupMarketplaceRoutes = [
  exact('POST', '/api/v1/groups', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await createGroup({
      userId: me.id,
      name: payload.name,
      members: payload.members ?? [],
      type: payload.type ?? 'private',
    }));
  }),
  exact('GET', '/api/v1/groups', async ({ req, res }) => {
    const me = await requireAuth(req);
    return json(res, 200, await listMyGroups(me.id));
  }),
  exact('POST', '/api/v1/groups/join', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await joinGroupByCode({
      userId: me.id,
      clubCode: payload.clubCode,
    }));
  }),
  pattern('POST', '/api/v1/groups/:id/join', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await joinGroup({
      userId: me.id,
      groupId: decodeURIComponent(params.id),
      clubCode: payload.clubCode,
    }));
  }),
  pattern('POST', '/api/v1/groups/:id/leave', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    return json(res, 200, await leaveGroup({
      userId: me.id,
      groupId: decodeURIComponent(params.id),
    }));
  }),
  pattern('POST', '/api/v1/groups/:id/members', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await addMembersToGroup({
      userId: me.id,
      groupId: decodeURIComponent(params.id),
      members: payload.members ?? [],
    }));
  }),
  pattern('GET', '/api/v1/groups/:id/messages', async ({ req, res, params, url }) => {
    const me = await requireAuth(req);
    return json(res, 200, await listGroupMessages({
      userId: me.id,
      groupId: decodeURIComponent(params.id),
      limit: maybeNumber(url.searchParams.get('limit')),
      before: url.searchParams.get('before') ?? undefined,
    }));
  }),
  pattern('POST', '/api/v1/groups/:id/messages', async ({ req, res, params }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await postGroupMessage({
      userId: me.id,
      groupId: decodeURIComponent(params.id),
      text: payload.text,
    }));
  }),
  exact('POST', '/api/v1/marketplace/listings', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 201, await createListing(me.id, payload));
  }),
  exact('GET', '/api/v1/marketplace/listings', async ({ req, res, url }) => {
    await requireAuth(req);
    return json(res, 200, await listListings({
      city: url.searchParams.get('city') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
    }));
  }),
];
