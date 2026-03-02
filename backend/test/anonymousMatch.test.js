import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch } from '../src/services/matchService.js';
import { store } from '../src/store/index.js';

async function createUsers(prefix, total) {
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const user = (await registerWithEmail({
      email: `${prefix}_${i}@padely.app`,
      password: `strongpass_${i}_2026`,
      displayName: `${prefix} ${i}`,
    })).user;
    out.push(user);
  }
  return out;
}

test('anonymous mode validates instantly and applies confidence multiplier', async () => {
  const [captain, partner] = await createUsers('anonymous_match', 2);
  const beforeCaptain = await store.getUserById(captain.id);

  const match = await createMatch({
    mode: 'anonymous',
    opponentLevel: 'advanced',
    matchFormat: 'standard',
    teamA: [captain.id, partner.id],
    teamB: [
      { kind: 'guest', guestName: 'Anon A', guestLevel: 'Confirme' },
      { kind: 'guest', guestName: 'Anon B', guestLevel: 'Confirme' },
    ],
    sets: [
      { a: 6, b: 4 },
      { a: 7, b: 6 },
    ],
  }, captain.id);

  assert.equal(match.mode, 'anonymous');
  assert.equal(match.status, 'validated');
  assert.equal(match.anonymousOpponents, true);
  assert.equal(match.opponentLevel, 'advanced');
  assert.equal(Number(match.confidenceMultiplier), 0.5);
  assert.equal(match.rated, true);

  const update = [...(match.ratingResult?.teamA ?? []), ...(match.ratingResult?.teamB ?? [])]
    .find((row) => row.id === captain.id);
  assert.ok(update);
  assert.equal(Number(update?.breakdown?.confidenceMultiplier), 0.5);

  const afterCaptain = await store.getUserById(captain.id);
  const historyEntry = (afterCaptain.history ?? []).at(-1);
  assert.ok(historyEntry);
  assert.equal(historyEntry.matchId, match.id);
  assert.equal(Number(afterCaptain.rating), Number(update.newRating));
  assert.equal(Number(afterCaptain.rating), Number((beforeCaptain.rating + Number(update.delta)).toFixed(2)));
});
