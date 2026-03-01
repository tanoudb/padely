import assert from 'node:assert/strict';
import test from 'node:test';
import { registerWithEmail } from '../src/services/authService.js';
import {
  closeLiveMatchSession,
  getLiveMatchState,
  pushLiveScoreUpdate,
  resetLiveMatchServiceForTests,
  startLiveMatchSession,
  subscribeLiveMatch,
} from '../src/services/liveMatchService.js';

function makeScore(pointsA, pointsB) {
  return {
    config: { setsToWin: 2, gamesToWinSet: 6 },
    sets: [],
    currentSet: { a: 0, b: 0 },
    points: { a: pointsA, b: pointsB },
    tieBreak: { active: false, a: 0, b: 0, firstServer: 'a', target: 7 },
    server: 'a',
    winner: null,
    sideChangeAlert: false,
    lastEvent: '',
  };
}

test('live scoring session streams updates and closes when persisted', async () => {
  resetLiveMatchServiceForTests();
  const seed = Date.now();

  const u1 = (await registerWithEmail({ email: `live1_${seed}@padely.app`, password: 'strongpass1', displayName: 'Live One' })).user;
  const u2 = (await registerWithEmail({ email: `live2_${seed}@padely.app`, password: 'strongpass2', displayName: 'Live Two' })).user;

  const session = startLiveMatchSession({
    createdBy: u1.id,
    participants: [u2.id],
    initialScoreState: makeScore(0, 0),
  });

  const seenEvents = [];
  const unsubscribe = subscribeLiveMatch({
    matchId: session.matchId,
    userId: u2.id,
    onEvent: (event) => seenEvents.push(event),
  });

  const update = pushLiveScoreUpdate({
    matchId: session.matchId,
    userId: u1.id,
    scoreState: makeScore(15, 0),
    actorDeviceId: 'device-alpha',
  });

  assert.equal(update.sequence, 1);
  assert.equal(update.scoreState.points.a, 15);

  const snapshot = getLiveMatchState({
    matchId: session.matchId,
    userId: u2.id,
  });

  assert.equal(snapshot.sequence, 1);
  assert.equal(snapshot.scoreState.points.a, 15);

  const closed = closeLiveMatchSession({
    matchId: session.matchId,
    userId: u1.id,
    reason: 'match_saved',
    linkedMatchId: 'mat_123',
  });

  assert.equal(closed.status, 'closed');
  assert.equal(closed.linkedMatchId, 'mat_123');

  unsubscribe();

  const eventsByType = seenEvents.reduce((acc, entry) => {
    const name = entry.event;
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});

  assert.equal(eventsByType.snapshot, 1);
  assert.equal(eventsByType.score_update, 1);
  assert.equal(eventsByType.session_closed, 1);

  resetLiveMatchServiceForTests();
});
