import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch, validateMatch } from '../src/services/matchService.js';
import { store } from '../src/store/index.js';

async function createPlayers(prefix, total) {
  const out = [];
  for (let index = 0; index < total; index += 1) {
    const user = (await registerWithEmail({
      email: `${prefix}_${index}@padely.app`,
      password: `strongpass_${index}_2026`,
      displayName: `${prefix} ${index}`,
    })).user;
    out.push(user);
  }
  return out;
}

async function validateAll(matchId, players, createdBy) {
  for (const userId of players.filter((id) => id !== createdBy)) {
    await validateMatch({ matchId, userId, accepted: true });
  }
}

test('validated close match stores stressTag and key-match flag', async () => {
  const [a1, a2, b1, b2] = await createPlayers('match_narrative_close', 4);
  await store.updateUser(a1.id, { rating: 1400 });
  await store.updateUser(a2.id, { rating: 1410 });
  await store.updateUser(b1.id, { rating: 1430 });
  await store.updateUser(b2.id, { rating: 1420 });

  const match = await createMatch({
    teamA: [a1.id, a2.id],
    teamB: [b1.id, b2.id],
    sets: [
      { a: 7, b: 6 },
      { a: 6, b: 7 },
      { a: 7, b: 6 },
    ],
    mode: 'ranked',
    matchFormat: 'standard',
    totalCostEur: 36,
    clubName: 'Narrative Club',
  }, a1.id);

  await validateAll(match.id, [a1.id, a2.id, b1.id, b2.id], a1.id);
  const validated = await store.getMatch(match.id);
  assert.equal(validated.isKeyMatch, true);
  assert.equal(['battle', 'chaos', 'controlled', 'easy'].includes(validated.stressTag), true);
});

test('large margin match gets easy stress tag', async () => {
  const [a1, a2, b1, b2] = await createPlayers('match_narrative_easy', 4);

  const match = await createMatch({
    teamA: [a1.id, a2.id],
    teamB: [b1.id, b2.id],
    sets: [
      { a: 6, b: 1 },
      { a: 6, b: 0 },
    ],
    mode: 'ranked',
    matchFormat: 'standard',
    totalCostEur: 30,
    clubName: 'Narrative Club',
  }, a1.id);

  await validateAll(match.id, [a1.id, a2.id, b1.id, b2.id], a1.id);
  const validated = await store.getMatch(match.id);
  assert.equal(validated.stressTag, 'easy');
});
