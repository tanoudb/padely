import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMatch } from '../src/engine/matchEngine.js';

test('evaluateMatch returns rating updates and PIR pillars', () => {
  const payload = {
    sets: [
      { a: 6, b: 4 },
      { a: 6, b: 2 },
    ],
    goldenPoints: {
      teamA: 3,
      teamB: 0,
    },
    teamA: [
      {
        id: 'a1',
        rating: 1310,
        calibration: { matchesPlayed: 0 },
        form: { currentWinStreak: 2, formIndex: 0.55 },
        pairRating: 1290,
        watch: {
          distanceKm: 2.6,
          calories: 620,
          intensityScore: 74,
          smashSpeedKmh: 128,
        },
        winners: 22,
        directErrors: 8,
        fairPlayScore: 4,
      },
      {
        id: 'a2',
        rating: 1240,
        calibration: { matchesPlayed: 6 },
        form: { currentWinStreak: 0, formIndex: 0.1 },
        watch: {
          distanceKm: 2.1,
          calories: 540,
          intensityScore: 70,
          smashSpeedKmh: 109,
        },
        winners: 18,
        directErrors: 10,
        fairPlayScore: 4,
      },
    ],
    teamB: [
      {
        id: 'b1',
        rating: 1280,
        calibration: { matchesPlayed: 1 },
        form: { currentWinStreak: 1, formIndex: -0.35 },
        watch: {
          distanceKm: 2.4,
          calories: 640,
          intensityScore: 80,
          smashSpeedKmh: 118,
        },
        winners: 16,
        directErrors: 13,
        fairPlayScore: 5,
      },
      {
        id: 'b2',
        rating: 1220,
        calibration: { matchesPlayed: 10 },
        form: { currentWinStreak: 0, formIndex: -0.4 },
        watch: {
          distanceKm: 2.7,
          calories: 710,
          intensityScore: 85,
          smashSpeedKmh: 122,
        },
        winners: 14,
        directErrors: 15,
        fairPlayScore: 5,
      },
    ],
  };

  const result = evaluateMatch(payload);

  assert.equal(result.summary.winner, 'A');
  assert.equal(result.teamA.length, 2);
  assert.equal(result.teamB.length, 2);

  for (const player of [...result.teamA, ...result.teamB]) {
    assert.ok(typeof player.delta === 'number');
    assert.ok(typeof player.newRating === 'number');
    assert.ok(typeof player.pir.pir === 'number');
    assert.ok(player.pir.pillars.power >= 0 && player.pir.pillars.power <= 100);
    assert.ok(typeof player.breakdown.baseK === 'number');
    assert.ok(typeof player.breakdown.streakMultiplier === 'number');
    assert.ok(typeof player.breakdown.momentumFactor === 'number');
  }

  assert.ok(result.teamA[0].delta > result.teamB[0].delta);
});
