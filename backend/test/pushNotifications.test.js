import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch, createPostMatchInvite, validateMatch } from '../src/services/matchService.js';
import { updatePushToken } from '../src/services/profileService.js';
import { resetPushServiceForTests, setPushSenderForTests } from '../src/services/pushService.js';

function countByType(sentMessages) {
  return sentMessages.reduce((acc, item) => {
    const type = item.data?.type ?? 'unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
}

test('stores push token and emits realtime notifications for match lifecycle', async () => {
  const seed = Date.now();
  const u1 = (await registerWithEmail({ email: `push1_${seed}@padely.app`, password: 'strongpass1', displayName: 'Push One' })).user;
  const u2 = (await registerWithEmail({ email: `push2_${seed}@padely.app`, password: 'strongpass2', displayName: 'Push Two' })).user;
  const u3 = (await registerWithEmail({ email: `push3_${seed}@padely.app`, password: 'strongpass3', displayName: 'Push Three' })).user;
  const u4 = (await registerWithEmail({ email: `push4_${seed}@padely.app`, password: 'strongpass4', displayName: 'Push Four' })).user;

  await updatePushToken(u1.id, { token: 'ExponentPushToken[token_u1]' });
  await updatePushToken(u2.id, { token: 'ExponentPushToken[token_u2]' });
  await updatePushToken(u3.id, { token: 'ExponentPushToken[token_u3]' });
  await updatePushToken(u4.id, { token: 'ExponentPushToken[token_u4]' });

  const sentMessages = [];
  setPushSenderForTests(async (messages) => {
    sentMessages.push(...messages);
    return { receipts: messages.length };
  });

  const match = await createMatch({
    teamA: [u1.id, u2.id],
    teamB: [u3.id, u4.id],
    sets: [
      { a: 6, b: 4 },
      { a: 6, b: 3 },
    ],
    goldenPoints: { teamA: 2, teamB: 1 },
    totalCostEur: 52,
    clubName: 'Padely Arena',
    mode: 'ranked',
  }, u1.id);

  await createPostMatchInvite(match.id, u1.id);
  await validateMatch({ matchId: match.id, userId: u2.id, accepted: true });
  await validateMatch({ matchId: match.id, userId: u3.id, accepted: true });
  await validateMatch({ matchId: match.id, userId: u4.id, accepted: true });

  const counts = countByType(sentMessages);

  assert.equal(counts.match_created, 2);
  assert.equal(counts.player_invited, 3);
  assert.equal(counts.match_validated, 3);

  resetPushServiceForTests();
});
