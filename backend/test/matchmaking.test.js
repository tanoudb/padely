import test from 'node:test';
import assert from 'node:assert/strict';
import { findBalancedMatches } from '../src/engine/matchmaking.js';

test('matchmaking returns closest 50/50 options first', () => {
  const players = [
    { id: 'p1', rating: 1350, lat: 45.764, lng: 4.8357 },
    { id: 'p2', rating: 1325, lat: 45.76, lng: 4.84 },
    { id: 'p3', rating: 1290, lat: 45.758, lng: 4.842 },
    { id: 'p4', rating: 1280, lat: 45.767, lng: 4.83 },
    { id: 'p5', rating: 1260, lat: 45.772, lng: 4.829 },
  ];

  const options = findBalancedMatches(players, { maxResults: 3 });

  assert.equal(options.length, 3);
  assert.ok(options[0].fairnessScore >= options[1].fairnessScore);
  assert.ok(options[1].fairnessScore >= options[2].fairnessScore);

  const topDistanceFrom50 = Math.abs(0.5 - options[0].probabilityTeamA);
  assert.ok(topDistanceFrom50 <= 0.08);
});
