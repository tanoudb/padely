import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDominationMultiplier,
  computeClutchBonus,
  computeCombativiteBonus,
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
