import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch } from '../src/services/matchService.js';

async function createFourPlayers(prefix) {
  const u1 = (await registerWithEmail({
    email: `${prefix}1@padely.app`,
    password: 'strongpass1',
    displayName: `${prefix}-1`,
  })).user;
  const u2 = (await registerWithEmail({
    email: `${prefix}2@padely.app`,
    password: 'strongpass2',
    displayName: `${prefix}-2`,
  })).user;
  const u3 = (await registerWithEmail({
    email: `${prefix}3@padely.app`,
    password: 'strongpass3',
    displayName: `${prefix}-3`,
  })).user;
  const u4 = (await registerWithEmail({
    email: `${prefix}4@padely.app`,
    password: 'strongpass4',
    displayName: `${prefix}-4`,
  })).user;

  return [u1, u2, u3, u4];
}

test('club format accepts standard-style completed sets', async () => {
  const [u1, u2, u3, u4] = await createFourPlayers('clubok');

  const match = await createMatch({
    teamA: [u1.id, u2.id],
    teamB: [u3.id, u4.id],
    matchFormat: 'club',
    sets: [
      { a: 7, b: 6 },
      { a: 6, b: 4 },
    ],
    goldenPoints: { teamA: 1, teamB: 0 },
    totalCostEur: 40,
    clubName: 'Club test',
  }, u1.id);

  assert.equal(match.matchFormat, 'club');
  assert.deepEqual(match.sets, [{ a: 7, b: 6 }, { a: 6, b: 4 }]);
});

test('club format rejects impossible set score', async () => {
  const [u1, u2, u3, u4] = await createFourPlayers('clubko');

  await assert.rejects(
    createMatch({
      teamA: [u1.id, u2.id],
      teamB: [u3.id, u4.id],
      matchFormat: 'club',
      sets: [
        { a: 5, b: 3 },
        { a: 6, b: 2 },
      ],
      goldenPoints: { teamA: 0, teamB: 0 },
      totalCostEur: 40,
      clubName: 'Club test',
    }, u1.id),
    /format club/
  );
});

test('default format stays standard and accepts 7-6 / 6-4', async () => {
  const [u1, u2, u3, u4] = await createFourPlayers('stdok');

  const match = await createMatch({
    teamA: [u1.id, u2.id],
    teamB: [u3.id, u4.id],
    sets: [
      { a: 7, b: 6 },
      { a: 6, b: 4 },
    ],
    goldenPoints: { teamA: 2, teamB: 1 },
    totalCostEur: 48,
    clubName: 'Padel Central',
  }, u1.id);

  assert.equal(match.matchFormat, 'standard');
});

test('marathon format uses short sets and accepts tie-break style 4-3 sets', async () => {
  const [u1, u2, u3, u4] = await createFourPlayers('marok');

  const match = await createMatch({
    teamA: [u1.id, u2.id],
    teamB: [u3.id, u4.id],
    matchFormat: 'marathon',
    sets: [
      { a: 4, b: 2 },
      { a: 2, b: 4 },
      { a: 4, b: 3 },
      { a: 4, b: 1 },
    ],
    goldenPoints: { teamA: 2, teamB: 1 },
    totalCostEur: 60,
    clubName: 'Padely Arena',
  }, u1.id);

  assert.equal(match.matchFormat, 'marathon');
  assert.deepEqual(match.sets, [{ a: 4, b: 2 }, { a: 2, b: 4 }, { a: 4, b: 3 }, { a: 4, b: 1 }]);
});

test('marathon format rejects impossible 6-5 set score', async () => {
  const [u1, u2, u3, u4] = await createFourPlayers('marko');

  await assert.rejects(
    createMatch({
      teamA: [u1.id, u2.id],
      teamB: [u3.id, u4.id],
      matchFormat: 'marathon',
      sets: [
        { a: 6, b: 5 },
        { a: 4, b: 2 },
        { a: 4, b: 2 },
      ],
      goldenPoints: { teamA: 0, teamB: 0 },
      totalCostEur: 40,
      clubName: 'Padely Arena',
    }, u1.id),
    /short-set rules/
  );
});

test('ranked mode rejects guest players', async () => {
  const [u1, u2, u3] = await createFourPlayers('rankg');

  await assert.rejects(
    createMatch({
      teamA: [u1.id, { kind: 'guest', guestName: 'Invite 1', guestLevel: 'Intermediaire' }],
      teamB: [u2.id, u3.id],
      matchFormat: 'standard',
      mode: 'ranked',
      sets: [
        { a: 6, b: 4 },
        { a: 6, b: 3 },
      ],
      goldenPoints: { teamA: 0, teamB: 0 },
      totalCostEur: 36,
      clubName: 'Padely Arena',
    }, u1.id),
    /only accepts registered players/
  );
});
