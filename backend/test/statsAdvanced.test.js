import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch, validateMatch } from '../src/services/matchService.js';
import { getDashboard, getHeadToHead, getRecords } from '../src/services/statsService.js';
import { store } from '../src/store/index.js';

async function createValidatedMatch({ teamA, teamB, sets, createdBy }) {
  const match = await createMatch({
    teamA,
    teamB,
    sets,
    matchMode: 'ranked',
    totalCostEur: 36,
    clubName: 'Padely Test Club',
  }, createdBy);

  const validators = [...teamA, ...teamB].filter((id) => id !== createdBy);
  for (const userId of validators) {
    await validateMatch({ matchId: match.id, userId, accepted: true });
  }
  return store.getMatch(match.id);
}

test('advanced stats expose period filtering, records and head-to-head', async () => {
  const me = (await registerWithEmail({ email: 'stats_me@padely.app', password: 'strongpass1', displayName: 'Stats Me' })).user;
  const mate = (await registerWithEmail({ email: 'stats_mate@padely.app', password: 'strongpass2', displayName: 'Stats Mate' })).user;
  const opp1 = (await registerWithEmail({ email: 'stats_opp1@padely.app', password: 'strongpass3', displayName: 'Stats Opp1' })).user;
  const opp2 = (await registerWithEmail({ email: 'stats_opp2@padely.app', password: 'strongpass4', displayName: 'Stats Opp2' })).user;

  const oldMatch = await createValidatedMatch({
    teamA: [me.id, mate.id],
    teamB: [opp1.id, opp2.id],
    sets: [{ a: 6, b: 1 }, { a: 6, b: 2 }],
    createdBy: me.id,
  });
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 45);
  await store.updateMatch(oldMatch.id, {
    createdAt: oldDate.toISOString(),
    validatedAt: oldDate.toISOString(),
  });

  await createValidatedMatch({
    teamA: [me.id, mate.id],
    teamB: [opp1.id, opp2.id],
    sets: [{ a: 6, b: 4 }, { a: 7, b: 6 }],
    createdBy: me.id,
  });

  const dashboardAll = await getDashboard(me.id, { viewerId: me.id, period: 'all' });
  const dashboardMonth = await getDashboard(me.id, { viewerId: me.id, period: 'month' });
  assert.equal(dashboardAll.matches, 2);
  assert.equal(dashboardMonth.matches, 1);
  assert.equal(dashboardMonth.period, 'month');
  assert.ok(Array.isArray(dashboardMonth.activityHeatmap));

  const head = await getHeadToHead(me.id, opp1.id, { viewerId: me.id, period: 'all' });
  assert.equal(head.totalMatches, 2);
  assert.equal(head.losses, 0);
  assert.equal(head.wins, 2);
  assert.ok(Array.isArray(head.recent));

  const records = await getRecords(me.id, { viewerId: me.id, period: 'all' });
  assert.equal(records.records.totalValidatedMatches, 2);
  assert.ok(records.records.bestWinStreak >= 2);
  assert.ok(records.records.longestMatch?.minutes > 0);
  assert.ok(Array.isArray(records.activityHeatmap));
});

test('stats access is blocked when profile is private', async () => {
  const privateUser = (await registerWithEmail({ email: 'stats_private@padely.app', password: 'strongpass5', displayName: 'Private User' })).user;
  const visitor = (await registerWithEmail({ email: 'stats_visitor@padely.app', password: 'strongpass6', displayName: 'Visitor User' })).user;

  await store.updateUser(privateUser.id, {
    privacy: {
      ...(privateUser.privacy ?? {}),
      publicProfile: false,
    },
  });

  await assert.rejects(
    () => getDashboard(privateUser.id, { viewerId: visitor.id, period: 'all' }),
    /private/i,
  );

  await assert.rejects(
    () => getRecords(privateUser.id, { viewerId: visitor.id, period: 'all' }),
    /private/i,
  );
});
