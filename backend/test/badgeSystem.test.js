import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { store } from '../src/store/index.js';
import { createMatch, validateMatch } from '../src/services/matchService.js';
import { evaluateBadges, getBadgeGlobalStats } from '../src/services/gamificationService.js';
import { updatePinnedBadges } from '../src/services/profileService.js';
import { resetPushServiceForTests, setPushSenderForTests } from '../src/services/pushService.js';

async function createValidatedMatch({ teamA, teamB, sets, createdBy, matchFormat = 'standard' }) {
  const match = await createMatch({
    teamA,
    teamB,
    sets,
    matchFormat,
    mode: 'ranked',
    totalCostEur: 36,
    clubName: 'Badge Test Club',
  }, createdBy);

  const validators = [...teamA, ...teamB].filter((id) => id !== createdBy);
  for (const userId of validators) {
    await validateMatch({ matchId: match.id, userId, accepted: true });
  }
  return store.getMatch(match.id);
}

async function createPlayers(prefix, total) {
  const out = [];
  for (let index = 0; index < total; index += 1) {
    const player = (await registerWithEmail({
      email: `${prefix}_${index}@padely.app`,
      password: `strongpass_${index}_2026`,
      displayName: `${prefix} ${index}`,
    })).user;
    out.push(player);
  }
  return out;
}

test('badge tier progression upgrades from bronze to silver to gold', async () => {
  const [main, ...friends] = await createPlayers('badge_tier', 16);

  await store.updateUser(main.id, {
    friends: friends.slice(0, 4).map((user) => user.id),
    community: {
      ...(main.community ?? {}),
      joinedClubChannels: [],
    },
  });

  let evaluation = await evaluateBadges(main.id, { source: 'tier_bronze' });
  const bronze = evaluation.catalog.find((badge) => badge.key === 'social_butterfly');
  assert.equal(bronze?.tier, 'bronze');

  await store.updateUser(main.id, {
    friends: friends.slice(0, 8).map((user) => user.id),
  });

  for (let i = 0; i < 16; i += 1) {
    await store.addPrivateMessage({
      id: `dm_tier_${i}_${main.id}`,
      fromUserId: i % 2 === 0 ? main.id : friends[0].id,
      toUserId: i % 2 === 0 ? friends[0].id : main.id,
      text: `hello_${i}`,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
    });
  }

  evaluation = await evaluateBadges(main.id, { source: 'tier_silver' });
  const silver = evaluation.catalog.find((badge) => badge.key === 'social_butterfly');
  assert.equal(silver?.tier, 'silver');
  assert.ok(evaluation.tierUpgrades.some((item) => item.badgeKey === 'social_butterfly' && item.newTier === 'silver'));

  await store.updateUser(main.id, {
    friends: friends.slice(0, 15).map((user) => user.id),
    community: {
      ...(main.community ?? {}),
      joinedClubChannels: ['club:a', 'club:b'],
    },
  });

  evaluation = await evaluateBadges(main.id, { source: 'tier_gold' });
  const gold = evaluation.catalog.find((badge) => badge.key === 'social_butterfly');
  assert.equal(gold?.tier, 'gold');
  assert.ok(evaluation.tierUpgrades.some((item) => item.badgeKey === 'social_butterfly' && item.newTier === 'gold'));
});

test('secret badge remains hidden until unlocked then reveals', async () => {
  const players = await createPlayers('badge_secret', 4);
  const [a, b, c, d] = players;

  let evaluation = await evaluateBadges(a.id, { source: 'secret_hidden' });
  const hiddenBefore = evaluation.catalog.find((badge) => badge.key === 'nail_biter');
  assert.equal(hiddenBefore?.hiddenLocked, true);
  assert.equal(hiddenBefore?.title, '???');

  for (let round = 0; round < 3; round += 1) {
    await createValidatedMatch({
      teamA: [a.id, b.id],
      teamB: [c.id, d.id],
      sets: [
        { a: 7, b: 6 },
        { a: 6, b: 7 },
        { a: 7, b: 6 },
      ],
      createdBy: a.id,
    });
  }

  evaluation = await evaluateBadges(a.id, { source: 'secret_reveal' });
  const hiddenAfter = evaluation.catalog.find((badge) => badge.key === 'nail_biter');
  assert.equal(hiddenAfter?.hiddenLocked, false);
  assert.equal(hiddenAfter?.tier, 'mythic');
  assert.equal(hiddenAfter?.title, 'Cardiologue');
});

test('badge global stats returns percentage by tier', async () => {
  const [u1, u2, u3, u4] = await createPlayers('badge_stats', 4);

  await store.updateUser(u1.id, {
    friends: [u2.id, u3.id, u4.id, 'usr_extra_1'],
  });
  await evaluateBadges(u1.id, { source: 'stats_bronze' });

  await store.updateUser(u2.id, {
    friends: [u1.id, u3.id, u4.id, 'usr_extra_2'],
  });
  await evaluateBadges(u2.id, { source: 'stats_bronze_2' });

  const stats = await getBadgeGlobalStats();
  assert.ok(typeof stats.totalUsers === 'number' && stats.totalUsers >= 4);
  const social = stats.badges.find((badge) => badge.key === 'social_butterfly');
  assert.ok(social);
  assert.ok(social.tiers.some((tier) => tier.tier === 'bronze'));
  assert.ok(social.tiers.every((tier) => typeof tier.percent === 'number'));
});

test('pinned badges endpoint stores at most 3 distinct badges', async () => {
  const [user] = await createPlayers('badge_pin', 1);
  const updated = await updatePinnedBadges(user.id, {
    pinnedBadges: ['warrior', 'sniper', 'warrior', 'ironman', 'metronome'],
  });
  assert.deepEqual(updated.settings.pinnedBadges, ['warrior', 'sniper', 'ironman']);
});

test('badge pushes include unlock and tier-up payloads', async () => {
  const [main, ...friends] = await createPlayers('badge_push', 9);
  await store.updateUser(main.id, {
    pushTokens: [{
      token: `ExponentPushToken[${main.id}]`,
      platform: 'ios',
      updatedAt: new Date().toISOString(),
    }],
    friends: friends.slice(0, 4).map((user) => user.id),
  });

  const sent = [];
  setPushSenderForTests(async (messages) => {
    sent.push(...messages);
    return { receipts: messages.length };
  });

  await createValidatedMatch({
    teamA: [main.id, friends[0].id],
    teamB: [friends[1].id, friends[2].id],
    sets: [{ a: 6, b: 2 }, { a: 6, b: 4 }],
    createdBy: main.id,
  });

  await store.updateUser(main.id, {
    friends: friends.map((user) => user.id),
  });
  for (let i = 0; i < 14; i += 1) {
    await store.addPrivateMessage({
      id: `dm_push_${i}_${main.id}`,
      fromUserId: i % 2 === 0 ? main.id : friends[0].id,
      toUserId: i % 2 === 0 ? friends[0].id : main.id,
      text: `dm_${i}`,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
    });
  }

  await createValidatedMatch({
    teamA: [main.id, friends[0].id],
    teamB: [friends[1].id, friends[3].id],
    sets: [{ a: 7, b: 6 }, { a: 6, b: 4 }],
    createdBy: main.id,
  });

  const unlockPush = sent.find((message) => message?.data?.type === 'badge_unlocked');
  const tierUpPush = sent.find((message) => message?.data?.type === 'badge_tier_up');
  assert.ok(unlockPush, 'expected badge_unlocked push payload');
  assert.ok(tierUpPush, 'expected badge_tier_up push payload');

  resetPushServiceForTests();
});
