import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCalibrationKFactor,
  computeDominationMultiplier,
  computeClutchBonus,
  computeCombativiteBonus,
  computeFormIndex,
  computeMomentumFactor,
  computeStreakMultiplier,
  softReset,
  inactivityDecay,
} from '../src/domain/pir.js';

test('domination multiplier rewards larger score gaps', () => {
  const stomp = computeDominationMultiplier([
    { a: 6, b: 0 },
    { a: 6, b: 0 },
  ]);

  const tight = computeDominationMultiplier([
    { a: 7, b: 6 },
    { a: 7, b: 6 },
  ]);

  assert.ok(stomp > tight);
});

test('clutch bonus reaches maximum when all golden points are won', () => {
  const bonus = computeClutchBonus(4, 4);
  assert.equal(bonus, 3);
});

test('combativite bonus appears on close underdog losses with high effort', () => {
  const bonus = computeCombativiteBonus({
    isUnderdog: true,
    lostBySmallMargin: true,
    distanceKm: 3,
    calories: 800,
    intensityScore: 90,
  });

  assert.ok(bonus > 0);
});

test('soft reset and inactivity decay keep rating bounded', () => {
  const reset = softReset(1900);
  assert.ok(reset < 1900);

  const decayed = inactivityDecay({ rating: 1200, weeksInactive: 10 });
  assert.ok(decayed < 1200);
  assert.ok(decayed >= 700);
});

test('streak multiplier activates at 3 and 5 consecutive wins', () => {
  assert.equal(computeStreakMultiplier({ currentWinStreak: 1, didWin: true }), 1);
  assert.equal(computeStreakMultiplier({ currentWinStreak: 2, didWin: true }), 1.1);
  assert.equal(computeStreakMultiplier({ currentWinStreak: 4, didWin: true }), 1.2);
  assert.equal(computeStreakMultiplier({ currentWinStreak: 7, didWin: false }), 1);
});

test('form index and momentum factor reflect recent form', () => {
  const hotHistory = [
    { delta: 5, didWin: true },
    { delta: 7, didWin: true },
    { delta: 4, didWin: true },
    { delta: -2, didWin: false },
    { delta: 8, didWin: true },
  ];
  const coldHistory = [
    { delta: -4, didWin: false },
    { delta: -3, didWin: false },
    { delta: 2, didWin: true },
    { delta: -6, didWin: false },
    { delta: -5, didWin: false },
  ];

  const hotForm = computeFormIndex(hotHistory);
  const coldForm = computeFormIndex(coldHistory);
  assert.ok(hotForm > coldForm);

  const hotMomentumOnWin = computeMomentumFactor({ formIndex: hotForm, didWin: true });
  const coldMomentumOnWin = computeMomentumFactor({ formIndex: coldForm, didWin: true });
  assert.ok(hotMomentumOnWin > coldMomentumOnWin);
});

test('calibration k factor decays from 40 to 24 over 10 matches', () => {
  assert.equal(computeCalibrationKFactor({ matchesPlayed: 0 }), 40);
  assert.equal(computeCalibrationKFactor({ matchesPlayed: 5 }), 32);
  assert.equal(computeCalibrationKFactor({ matchesPlayed: 10 }), 24);
  assert.equal(computeCalibrationKFactor({ matchesPlayed: 22 }), 24);
});
