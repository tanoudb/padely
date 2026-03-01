import { newId } from '../utils/id.js';

const LIVE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const sessions = new Map();
const subscribers = new Map();

function nowIso() {
  return new Date().toISOString();
}

function toParticipantList(raw = []) {
  const unique = new Set();
  const out = [];

  for (const candidate of raw) {
    const id = String(candidate ?? '').trim();
    if (!id || unique.has(id)) {
      continue;
    }
    unique.add(id);
    out.push(id);
  }

  return out;
}

function sanitizeScoreState(input = {}) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    config: state.config ?? {},
    sets: Array.isArray(state.sets) ? state.sets : [],
    currentSet: state.currentSet ?? { a: 0, b: 0 },
    points: state.points ?? { a: 0, b: 0 },
    tieBreak: state.tieBreak ?? { active: false, a: 0, b: 0, firstServer: 'a', target: 7 },
    server: state.server ?? 'a',
    winner: state.winner ?? null,
    sideChangeAlert: Boolean(state.sideChangeAlert),
    lastEvent: String(state.lastEvent ?? ''),
    history: [],
  };
}

function sessionPublicView(session) {
  return {
    matchId: session.id,
    status: session.status,
    createdBy: session.createdBy,
    participants: session.participants,
    linkedMatchId: session.linkedMatchId ?? null,
    sequence: session.sequence,
    updatedAt: session.updatedAt,
    createdAt: session.createdAt,
    scoreState: session.scoreState,
    metadata: session.metadata ?? {},
  };
}

function assertParticipant(session, userId) {
  if (!session) {
    throw new Error('Live match not found');
  }
  if (!session.participants.includes(userId)) {
    throw new Error('User not allowed for this live match');
  }
}

function sendEvent(matchId, eventName, payload) {
  const callbacks = subscribers.get(matchId);
  if (!callbacks || callbacks.size === 0) {
    return;
  }

  for (const callback of callbacks) {
    try {
      callback({ event: eventName, data: payload });
    } catch {
      // Ignore per-listener failures.
    }
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.updatedAtMs > LIVE_SESSION_TTL_MS) {
      sessions.delete(sessionId);
      subscribers.delete(sessionId);
    }
  }
}

export function startLiveMatchSession({
  createdBy,
  participants = [],
  initialScoreState = {},
  metadata = {},
}) {
  cleanupExpiredSessions();

  const owner = String(createdBy ?? '').trim();
  if (!owner) {
    throw new Error('createdBy is required');
  }

  const allParticipants = toParticipantList([owner, ...participants]);
  if (allParticipants.length < 2) {
    throw new Error('Live match requires at least 2 participants');
  }
  if (allParticipants.length > 4) {
    throw new Error('Live match cannot exceed 4 participants');
  }

  const id = newId('live');
  const createdAt = nowIso();
  const session = {
    id,
    createdBy: owner,
    participants: allParticipants,
    scoreState: sanitizeScoreState(initialScoreState),
    status: 'active',
    sequence: 0,
    linkedMatchId: null,
    metadata,
    createdAt,
    updatedAt: createdAt,
    updatedAtMs: Date.now(),
  };

  sessions.set(id, session);
  subscribers.set(id, new Set());

  return sessionPublicView(session);
}

export function getLiveMatchState({ matchId, userId }) {
  cleanupExpiredSessions();

  const id = String(matchId ?? '').trim();
  const actor = String(userId ?? '').trim();
  const session = sessions.get(id);
  assertParticipant(session, actor);
  return sessionPublicView(session);
}

export function pushLiveScoreUpdate({
  matchId,
  userId,
  scoreState,
  actorDeviceId,
}) {
  cleanupExpiredSessions();

  const id = String(matchId ?? '').trim();
  const actor = String(userId ?? '').trim();
  const session = sessions.get(id);
  assertParticipant(session, actor);

  if (session.status !== 'active') {
    throw new Error('Live match is closed');
  }

  session.sequence += 1;
  session.scoreState = sanitizeScoreState(scoreState);
  session.updatedAt = nowIso();
  session.updatedAtMs = Date.now();
  sessions.set(id, session);

  const payload = {
    matchId: session.id,
    sequence: session.sequence,
    actorUserId: actor,
    actorDeviceId: actorDeviceId ? String(actorDeviceId) : null,
    status: session.status,
    updatedAt: session.updatedAt,
    scoreState: session.scoreState,
  };

  sendEvent(id, 'score_update', payload);
  return payload;
}

export function closeLiveMatchSession({
  matchId,
  userId,
  reason = 'match_saved',
  linkedMatchId = null,
}) {
  cleanupExpiredSessions();

  const id = String(matchId ?? '').trim();
  const actor = String(userId ?? '').trim();
  const session = sessions.get(id);
  assertParticipant(session, actor);

  session.status = 'closed';
  session.linkedMatchId = linkedMatchId ? String(linkedMatchId) : session.linkedMatchId;
  session.updatedAt = nowIso();
  session.updatedAtMs = Date.now();
  sessions.set(id, session);

  const payload = {
    matchId: session.id,
    status: session.status,
    reason,
    linkedMatchId: session.linkedMatchId,
    updatedAt: session.updatedAt,
    scoreState: session.scoreState,
  };

  sendEvent(id, 'session_closed', payload);
  return sessionPublicView(session);
}

export function subscribeLiveMatch({ matchId, userId, onEvent }) {
  cleanupExpiredSessions();

  const id = String(matchId ?? '').trim();
  const actor = String(userId ?? '').trim();
  const session = sessions.get(id);
  assertParticipant(session, actor);

  if (typeof onEvent !== 'function') {
    throw new Error('onEvent callback is required');
  }

  const listeners = subscribers.get(id) ?? new Set();
  listeners.add(onEvent);
  subscribers.set(id, listeners);

  onEvent({
    event: 'snapshot',
    data: sessionPublicView(session),
  });

  return () => {
    const current = subscribers.get(id);
    if (!current) {
      return;
    }
    current.delete(onEvent);
    if (current.size === 0) {
      subscribers.set(id, current);
    }
  };
}

export function resetLiveMatchServiceForTests() {
  sessions.clear();
  subscribers.clear();
}
