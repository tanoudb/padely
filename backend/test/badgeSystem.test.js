import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { store } from '../src/store/index.js';
import { createMatch, validateMatch } from '../src/services/matchService.js';
import { evaluateBadges } from '../src/services/gamificationService.js';
import { resetPushServiceForTests, setPushSenderForTests } from '../src/services/pushService.js';

test('badge system unlocks and notifies after validated match', async () => {
  const p1 = (await registerWithEmail({
    email: 'badge_p1@padely.app',
    password: 'strongpass1',
    displayName: 'Badge P1',
  })).user;
  const p2 = (await registerWithEmail({
    email: 'badge_p2@padely.app',
    password: 'strongpass2',
    displayName: 'Badge P2',
  })).user;
  const p3 = (await registerWithEmail({
    email: 'badge_p3@padely.app',
    password: 'strongpass3',
    displayName: 'Badge P3',
  })).user;
  const p4 = (await registerWithEmail({
    email: 'badge_p4@padely.app',
    password: 'strongpass4',
    displayName: 'Badge P4',
  })).user;

  await store.updateUser(p1.id, {
    city: 'Paris',
    pushTokens: [{
      token: 'ExponentPushToken[badge-p1]',
      platform: 'ios',
      updatedAt: new Date().toISOString(),
    }],
  });
  await store.updateUser(p2.id, { city: 'Paris' });
  await store.updateUser(p3.id, { city: 'Paris' });
  await store.updateUser(p4.id, { city: 'Paris' });

  const sent = [];
  setPushSenderForTests(async (messages) => {
    sent.push(...messages);
    return { receipts: messages.length };
  });

  const match = await createMatch({
    teamA: [p1.id, p2.id],
    teamB: [p3.id, p4.id],
    sets: [
      { a: 6, b: 0 },
      { a: 6, b: 1 },
    ],
    goldenPoints: { teamA: 16, teamB: 0 },
    totalCostEur: 48,
    clubName: 'Padely Club Paris',
    matchFormat: 'standard',
  }, p1.id);

  await validateMatch({ matchId: match.id, userId: p2.id, accepted: true });
  await validateMatch({ matchId: match.id, userId: p3.id, accepted: true });
  const validated = await validateMatch({ matchId: match.id, userId: p4.id, accepted: true });
  assert.equal(validated.status, 'validated');

  const badges = await evaluateBadges(p1.id, { source: 'test_check' });
  const firstBlood = badges.catalog.find((badge) => badge.key === 'first_blood');
  const goldenTouch = badges.catalog.find((badge) => badge.key === 'golden_touch');
  assert.equal(firstBlood?.unlocked, true);
  assert.equal(goldenTouch?.unlocked, true);
  assert.equal(badges.catalog.length, 8);

  const badgePush = sent.find((message) => message?.data?.type === 'badge_unlocked');
  assert.ok(badgePush, 'expected at least one badge_unlocked push payload');

  resetPushServiceForTests();
});

test('social butterfly badge unlocks from friends, clubs and DM activity', async () => {
  const main = (await registerWithEmail({
    email: 'badge_social_main@padely.app',
    password: 'strongpass1',
    displayName: 'Badge Social Main',
  })).user;
  const f1 = (await registerWithEmail({
    email: 'badge_social_f1@padely.app',
    password: 'strongpass2',
    displayName: 'Badge Social F1',
  })).user;
  const f2 = (await registerWithEmail({
    email: 'badge_social_f2@padely.app',
    password: 'strongpass3',
    displayName: 'Badge Social F2',
  })).user;
  const f3 = (await registerWithEmail({
    email: 'badge_social_f3@padely.app',
    password: 'strongpass4',
    displayName: 'Badge Social F3',
  })).user;
  const f4 = (await registerWithEmail({
    email: 'badge_social_f4@padely.app',
    password: 'strongpass5',
    displayName: 'Badge Social F4',
  })).user;

  await store.updateUser(main.id, {
    friends: [f1.id, f2.id, f3.id, f4.id],
    community: {
      ...(main.community ?? {}),
      joinedClubChannels: ['club:alpha'],
    },
  });

  if (typeof store.addPrivateMessage === 'function') {
    for (let i = 0; i < 22; i += 1) {
      await store.addPrivateMessage({
        id: `msg_social_${i}`,
        fromUserId: i % 2 === 0 ? main.id : f1.id,
        toUserId: i % 2 === 0 ? f1.id : main.id,
        text: `hello ${i}`,
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
  }

  const badges = await evaluateBadges(main.id, { source: 'social_test' });
  assert.ok(badges.badges.includes('social_butterfly'));
});
