import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWithEmail } from '../src/services/authService.js';
import {
  addFriend,
  getUnreadSummary,
  listPrivateMessagesForUser,
  markChannelRead,
  markPrivateRead,
  postChannelMessage,
  postPrivateMessage,
  resetCommunityRealtimeForTests,
  subscribeCommunityFeed,
} from '../src/services/communityService.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('community realtime emits events and keeps unread/pagination consistent', async () => {
  resetCommunityRealtimeForTests();
  const seed = Date.now();
  const u1 = (await registerWithEmail({
    email: `crew_rt_1_${seed}@padely.app`,
    password: 'strongpass1',
    displayName: 'Crew One',
  })).user;
  const u2 = (await registerWithEmail({
    email: `crew_rt_2_${seed}@padely.app`,
    password: 'strongpass2',
    displayName: 'Crew Two',
  })).user;

  await addFriend(u1.id, u2.id);

  const seen = [];
  const unsubscribe = subscribeCommunityFeed({
    userId: u2.id,
    onEvent: (evt) => seen.push(evt),
  });

  await postPrivateMessage({ fromUserId: u1.id, toUserId: u2.id, text: 'Salut 1' });
  await postPrivateMessage({ fromUserId: u1.id, toUserId: u2.id, text: 'Salut 2' });
  await postChannelMessage({ userId: u1.id, channel: 'france', text: 'Hello France' });

  await delay(5);

  const dmEvent = seen.find((evt) => evt.event === 'dm_message');
  assert.ok(dmEvent, 'dm_message event must be emitted');

  const channelEvent = seen.find((evt) => evt.event === 'channel_message');
  assert.ok(channelEvent, 'channel_message event must be emitted');

  const unreadBeforeRead = await getUnreadSummary(u2.id);
  assert.equal(unreadBeforeRead.dms[u1.id], 2);
  assert.ok((unreadBeforeRead.channels.france ?? 0) >= 1);

  const page1 = await listPrivateMessagesForUser(u2.id, u1.id, { limit: 1 });
  assert.equal(page1.items.length, 1);
  assert.equal(page1.hasMore, true);
  assert.ok(page1.nextCursor);

  const page2 = await listPrivateMessagesForUser(u2.id, u1.id, { limit: 1, before: page1.nextCursor });
  assert.equal(page2.items.length, 1);

  await markPrivateRead(u2.id, u1.id);
  await markChannelRead(u2.id, 'france');

  const unreadAfterRead = await getUnreadSummary(u2.id);
  assert.equal(unreadAfterRead.dms[u1.id], 0);
  assert.equal(unreadAfterRead.channels.france, 0);

  unsubscribe();
});
