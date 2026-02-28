import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { addRacket, getBag } from '../src/services/bagService.js';
import {
  createMatch,
  getMatch,
  listMatchesForUser,
  validateMatch,
} from '../src/services/matchService.js';
import { getDashboard } from '../src/services/statsService.js';

test('end-to-end mvp flow: register, create match, validate and compute stats', async () => {
  const u1 = (await registerWithEmail({ email: 'mvp1@padely.app', password: 'strongpass1', displayName: 'MVP1' })).user;
  const u2 = (await registerWithEmail({ email: 'mvp2@padely.app', password: 'strongpass2', displayName: 'MVP2' })).user;
  const u3 = (await registerWithEmail({ email: 'mvp3@padely.app', password: 'strongpass3', displayName: 'MVP3' })).user;
  const u4 = (await registerWithEmail({ email: 'mvp4@padely.app', password: 'strongpass4', displayName: 'MVP4' })).user;

  const racket = await addRacket(u1.id, { brand: 'Babolat', model: 'Air Viper', maxHours: 90 });
  assert.equal(racket.brand, 'Babolat');

  const match = await createMatch({
    teamA: [u1.id, u2.id],
    teamB: [u3.id, u4.id],
    sets: [
      { a: 6, b: 4 },
      { a: 6, b: 3 },
    ],
    goldenPoints: { teamA: 2, teamB: 1 },
    totalCostEur: 48,
    clubName: 'Padel Central',
  }, u1.id);

  assert.equal(match.validation.pendingValidators.length, 3);
  const listBefore = await listMatchesForUser(u2.id);
  assert.equal(listBefore[0].canValidate, true);

  await validateMatch({ matchId: match.id, userId: u2.id, accepted: true });
  const listAfterVote = await listMatchesForUser(u2.id);
  assert.equal(listAfterVote[0].canValidate, false);
  const validated = await validateMatch({ matchId: match.id, userId: u3.id, accepted: true });

  assert.equal(validated.status, 'validated');

  const full = await getMatch(match.id);
  assert.ok(full.ratingResult);

  const bag = await getBag(u1.id);
  assert.equal(bag.length, 1);
  assert.ok(bag[0].hoursPlayed > 0);

  const stats = await getDashboard(u1.id);
  assert.equal(stats.matches, 1);
  assert.ok(typeof stats.rating === 'number');
});
