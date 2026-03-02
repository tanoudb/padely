import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { updateAthleteProfile } from '../src/services/profileService.js';
import { getTemporalLeaderboard } from '../src/services/communityService.js';
import { ensureSeasonTransition, getSeasonsOverview } from '../src/services/seasonService.js';
import { store } from '../src/store/index.js';

test('season overview exposes current quarter progress and city ranking', async () => {
  const user = (await registerWithEmail({
    email: 'season_overview@padely.app',
    password: 'strongpass1',
    displayName: 'Season Overview',
  })).user;
  await updateAthleteProfile(user.id, { city: 'Paris' });

  const withHistory = await store.updateUser(user.id, {
    history: [
      { at: new Date().toISOString(), delta: 16 },
      { at: new Date().toISOString(), delta: -5 },
    ],
  });
  assert.ok(withHistory);

  const board = await getTemporalLeaderboard({ city: 'Paris', period: 'season' });
  assert.equal(board.period, 'season');
  assert.ok(Array.isArray(board.rows));

  const seasons = await getSeasonsOverview({ userId: user.id, city: 'Paris' });
  assert.ok(seasons.current?.label?.startsWith('S'));
  assert.equal(typeof seasons.current?.progress, 'number');
  assert.ok(seasons.current.progress >= 0 && seasons.current.progress <= 1);
  assert.equal(typeof seasons.current?.daysRemaining, 'number');
});

test('season transition archives previous leaderboard and soft-resets rating + pir', async () => {
  const user = (await registerWithEmail({
    email: 'season_transition@padely.app',
    password: 'strongpass2',
    displayName: 'Season Transition',
  })).user;
  await updateAthleteProfile(user.id, { city: 'Paris' });

  await store.updateUser(user.id, {
    rating: 2010,
    pir: 82,
    history: [
      { at: '2025-12-15T12:00:00.000Z', delta: 24 },
      { at: '2025-12-20T12:00:00.000Z', delta: 11 },
    ],
  });

  if (typeof store.setSeasonState === 'function') {
    await store.setSeasonState({
      currentSeasonKey: '2025-S4',
      transitionedAt: '2025-12-31T22:00:00.000Z',
    });
  }

  await ensureSeasonTransition();
  const updated = await store.getUserById(user.id);
  assert.ok(updated.rating < 2010);
  assert.ok(updated.pir < 82);

  if (typeof store.getSeasonLeaderboardArchive === 'function') {
    const archived = await store.getSeasonLeaderboardArchive('2025-S4', 'Paris');
    assert.ok(Array.isArray(archived));
    assert.ok(archived.some((row) => row.userId === user.id));
  }
});
