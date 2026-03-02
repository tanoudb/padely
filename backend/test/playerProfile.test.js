import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { createMatch, validateMatch } from '../src/services/matchService.js';
import { store } from '../src/store/index.js';
import { computePlayerProfile, evaluateAndPersistPlayerProfile } from '../src/services/playerProfileService.js';

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

async function createValidatedMatch({
  teamA,
  teamB,
  sets,
  createdBy,
  matchFormat = 'standard',
}) {
  const match = await createMatch({
    teamA,
    teamB,
    sets,
    mode: 'ranked',
    matchFormat,
    totalCostEur: 40,
    clubName: 'Profile Test Club',
  }, createdBy);

  const validators = [...teamA, ...teamB].filter((id) => id !== createdBy);
  for (const userId of validators) {
    await validateMatch({ matchId: match.id, userId, accepted: true });
  }
  return store.getMatch(match.id);
}

test('player profile type detects chill, regular and competitor', async () => {
  const players = await createPlayers('profile_type', 10);
  const [chill, regular, regularMate, competitor, competitorMate, opp1, opp2, opp3, opp4] = players;

  const chillProfile = await computePlayerProfile(chill.id);
  assert.equal(chillProfile.playerProfile.type, 'chill');

  for (let index = 0; index < 6; index += 1) {
    const regularWins = index % 2 === 0;
    await createValidatedMatch({
      teamA: [regular.id, regularMate.id],
      teamB: [opp1.id, opp2.id],
      sets: regularWins ? [{ a: 6, b: 3 }, { a: 6, b: 4 }] : [{ a: 4, b: 6 }, { a: 6, b: 7 }],
      createdBy: regular.id,
    });
  }
  const regularProfile = await computePlayerProfile(regular.id);
  assert.equal(regularProfile.playerProfile.type, 'regular');

  for (let index = 0; index < 5; index += 1) {
    await createValidatedMatch({
      teamA: [competitor.id, competitorMate.id],
      teamB: [opp3.id, opp4.id],
      sets: [{ a: 6, b: 4 }, { a: 7, b: 6 }],
      createdBy: competitor.id,
    });
  }
  const competitorProfile = await computePlayerProfile(competitor.id);
  assert.equal(competitorProfile.playerProfile.type, 'competitor');
});

test('player personality and rivalries are computed from recent matches', async () => {
  const [main, mate, strong1, strong2] = await createPlayers('profile_personality', 4);
  await store.updateUser(main.id, { rating: 900 });
  await store.updateUser(mate.id, { rating: 920 });
  await store.updateUser(strong1.id, { rating: 1850 });
  await store.updateUser(strong2.id, { rating: 1820 });

  for (let index = 0; index < 4; index += 1) {
    await createValidatedMatch({
      teamA: [main.id, mate.id],
      teamB: [strong1.id, strong2.id],
      sets: [{ a: 7, b: 6 }, { a: 6, b: 4 }],
      createdBy: main.id,
    });
  }

  const profile = await computePlayerProfile(main.id);
  assert.equal(profile.playerProfile.personality, 'strategist');
  assert.ok(Array.isArray(profile.playerProfile.rivalries));
  assert.ok(profile.playerProfile.rivalries.length >= 1);
  assert.equal(profile.playerProfile.rivalries[0].opponentId, strong1.id);
});

test('comeback mode activates after pause then deactivates after new match', async () => {
  const [main, mate, opp1, opp2] = await createPlayers('profile_comeback', 4);

  const first = await createValidatedMatch({
    teamA: [main.id, mate.id],
    teamB: [opp1.id, opp2.id],
    sets: [{ a: 6, b: 2 }, { a: 6, b: 2 }],
    createdBy: main.id,
  });

  const oldDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
  await store.updateMatch(first.id, {
    createdAt: oldDate,
    validatedAt: oldDate,
  });

  let profile = await evaluateAndPersistPlayerProfile(main.id);
  assert.equal(profile.playerProfile.comebackMode.active, true);
  assert.ok(Number(profile.playerProfile.comebackMode.daysSinceLastMatch) >= 14);
  assert.ok(typeof profile.playerProfile.formScore === 'number');
  assert.ok(profile.playerProfile.formScore >= 0 && profile.playerProfile.formScore <= 100);

  await createValidatedMatch({
    teamA: [main.id, mate.id],
    teamB: [opp1.id, opp2.id],
    sets: [{ a: 6, b: 4 }, { a: 7, b: 6 }],
    createdBy: main.id,
  });

  profile = await evaluateAndPersistPlayerProfile(main.id);
  assert.equal(profile.playerProfile.comebackMode.active, false);
});
