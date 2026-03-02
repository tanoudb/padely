import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch } from '../src/services/matchService.js';
import { updateAthleteProfile } from '../src/services/profileService.js';
import { store } from '../src/store/index.js';
import { getMatchmakingSuggestions, proposeMatchmakingInvite } from '../src/services/matchmakingService.js';
import { listPrivateMessages } from '../src/services/communityService.js';
import { resetPushServiceForTests, setPushSenderForTests } from '../src/services/pushService.js';

async function makeUser(seed, suffix, displayName) {
  return (await registerWithEmail({
    email: `mm_${suffix}_${seed}@padely.app`,
    password: 'strongpass1',
    displayName,
  })).user;
}

test('matchmaking suggestions apply city/rating/activity/history filters and compute compatibility', async () => {
  const seed = Date.now();
  const me = await makeUser(seed, 'me', 'Match Me');
  const good = await makeUser(seed, 'good', 'Good Candidate');
  const inactive = await makeUser(seed, 'inactive', 'Old Candidate');
  const farRating = await makeUser(seed, 'far', 'Far Candidate');
  const otherCity = await makeUser(seed, 'city', 'Paris Candidate');
  const faced = await makeUser(seed, 'faced', 'Faced Candidate');
  const filler = await makeUser(seed, 'filler', 'Filler Player');
  const filler2 = await makeUser(seed, 'filler2', 'Filler Two');

  await Promise.all([
    store.updateUser(me.id, { rating: 1400, city: 'Lyon' }),
    store.updateUser(good.id, { rating: 1470, city: 'Lyon' }),
    store.updateUser(inactive.id, { rating: 1420, city: 'Lyon' }),
    store.updateUser(farRating.id, { rating: 1655, city: 'Lyon' }),
    store.updateUser(otherCity.id, { rating: 1410, city: 'Paris' }),
    store.updateUser(faced.id, { rating: 1435, city: 'Lyon' }),
    store.updateUser(filler.id, { rating: 1375, city: 'Lyon' }),
    store.updateUser(filler2.id, { rating: 1360, city: 'Lyon' }),
  ]);

  const inactiveDate = new Date(Date.now() - 16 * 86_400_000).toISOString();
  await store.updateUser(inactive.id, {
    createdAt: inactiveDate,
    history: [{ at: inactiveDate, delta: 4, didWin: true }],
  });

  await createMatch({
    teamA: [me.id, filler.id],
    teamB: [faced.id, filler2.id],
    sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }],
    mode: 'friendly',
  }, me.id);

  const out = await getMatchmakingSuggestions(me.id, { city: 'Lyon', limit: 10 });

  assert.equal(out.city, 'Lyon');
  assert.ok(Array.isArray(out.suggestions));
  assert.equal(out.suggestions.length, 1);
  assert.equal(out.suggestions[0].userId, good.id);
  assert.ok(out.suggestions[0].compatibility >= 50);
  assert.ok(out.suggestions[0].compatibility <= 100);
  assert.ok(out.suggestions[0].lastActiveAt);
});

test('propose matchmaking invite creates dm, links friends and sends push', async () => {
  const seed = Date.now();
  const from = await makeUser(seed, 'from', 'Proposer One');
  const to = await makeUser(seed, 'to', 'Proposer Two');

  await Promise.all([
    store.updateUser(from.id, { city: 'Lyon' }),
    store.updateUser(to.id, { city: 'Lyon', pushTokens: [{ token: 'ExponentPushToken[token_mm_to]' }] }),
  ]);

  const sent = [];
  setPushSenderForTests(async (messages) => {
    sent.push(...messages);
    return { receipts: messages.length };
  });

  const result = await proposeMatchmakingInvite({
    fromUserId: from.id,
    targetUserId: to.id,
    message: 'Dispo jeudi 19h ?'
  });

  assert.equal(result.invited, true);
  assert.equal(result.targetUserId, to.id);

  const fromFresh = await store.getUserById(from.id);
  const toFresh = await store.getUserById(to.id);
  assert.ok((fromFresh.friends ?? []).includes(to.id));
  assert.ok((toFresh.friends ?? []).includes(from.id));

  const dms = await listPrivateMessages(from.id, to.id, 10);
  assert.equal(dms.length, 1);
  assert.ok(dms[0].text.includes('Invitation match Padely'));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].data?.type, 'matchmaking_invite');
  assert.equal(sent[0].data?.fromUserId, from.id);

  resetPushServiceForTests();
});
