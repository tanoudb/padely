function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function withoutHistory(state) {
  const copy = clone(state);
  copy.history = [];
  return copy;
}

function opposite(side) {
  return side === 'a' ? 'b' : 'a';
}

function shouldUseTieBreak(setIndex, config) {
  const decidingSetIndex = (config.setsToWin * 2) - 2;
  if (config.noTieBreakInDecidingSet && setIndex === decidingSetIndex) {
    return false;
  }
  return true;
}

export function createScoreState(config = {}) {
  return {
    config: {
      puntoDeOro: Boolean(config.puntoDeOro),
      tieBreakPoints: config.tieBreakPoints ?? 7,
      setsToWin: config.setsToWin ?? 3,
      noTieBreakInDecidingSet: config.noTieBreakInDecidingSet ?? true,
    },
    sets: [],
    currentSet: { a: 0, b: 0 },
    points: { a: 0, b: 0 },
    tieBreak: {
      active: false,
      a: 0,
      b: 0,
      firstServer: 'a',
    },
    server: 'a',
    winner: null,
    sideChangeAlert: false,
    lastEvent: '',
    history: [],
  };
}

function countSetsWon(sets, side) {
  return sets.filter((set) => (side === 'a' ? set.a > set.b : set.b > set.a)).length;
}

function evaluateMatchEnd(state) {
  const setsWonA = countSetsWon(state.sets, 'a');
  const setsWonB = countSetsWon(state.sets, 'b');
  const target = state.config.setsToWin ?? 3;
  if (setsWonA >= target) {
    state.winner = 'a';
    state.lastEvent = 'Victoire equipe rouge';
    return;
  }

  if (setsWonB >= target) {
    state.winner = 'b';
    state.lastEvent = 'Victoire equipe bleue';
  }
}

function startNextSet(state) {
  state.currentSet = { a: 0, b: 0 };
  state.points = { a: 0, b: 0 };
  state.tieBreak = { active: false, a: 0, b: 0, firstServer: state.server };
  state.sideChangeAlert = false;
}

function finalizeSet(state) {
  state.sets.push({ a: state.currentSet.a, b: state.currentSet.b });
  evaluateMatchEnd(state);
  if (!state.winner) {
    startNextSet(state);
  }
}

function shouldWinGame(pointsA, pointsB, puntoDeOro) {
  if (puntoDeOro) {
    if (pointsA >= 3 && pointsB >= 3) {
      return Math.abs(pointsA - pointsB) >= 1;
    }
    return (pointsA >= 4 || pointsB >= 4) && Math.abs(pointsA - pointsB) >= 2;
  }

  return (pointsA >= 4 || pointsB >= 4) && Math.abs(pointsA - pointsB) >= 2;
}

function maybeSetEnd(state) {
  const ga = state.currentSet.a;
  const gb = state.currentSet.b;
  const diff = Math.abs(ga - gb);
  const setIndex = state.sets.length;

  if (ga >= 6 || gb >= 6) {
    if (ga === 6 && gb === 6 && shouldUseTieBreak(setIndex, state.config)) {
      state.tieBreak.active = true;
      state.tieBreak.a = 0;
      state.tieBreak.b = 0;
      state.tieBreak.firstServer = state.server;
      state.lastEvent = 'Tie-break';
      return;
    }

    if (diff >= 2 && (ga >= 6 || gb >= 6)) {
      finalizeSet(state);
      return;
    }
  }

  const gamesInCurrentSet = ga + gb;
  state.sideChangeAlert = gamesInCurrentSet > 0 && gamesInCurrentSet % 2 === 1;
}

function winGame(state, side) {
  if (side === 'a') {
    state.currentSet.a += 1;
  } else {
    state.currentSet.b += 1;
  }

  state.points = { a: 0, b: 0 };
  state.server = opposite(state.server);
  state.lastEvent = `Jeu equipe ${side === 'a' ? 'rouge' : 'bleue'}`;
  maybeSetEnd(state);
}

function tieBreakServer(firstServer, totalPointsPlayed) {
  if (totalPointsPlayed === 0) {
    return firstServer;
  }

  const block = Math.floor((totalPointsPlayed - 1) / 2);
  return block % 2 === 0 ? opposite(firstServer) : firstServer;
}

function winTieBreakPoint(state, side) {
  if (side === 'a') {
    state.tieBreak.a += 1;
  } else {
    state.tieBreak.b += 1;
  }

  const ta = state.tieBreak.a;
  const tb = state.tieBreak.b;
  const diff = Math.abs(ta - tb);

  if ((ta >= state.config.tieBreakPoints || tb >= state.config.tieBreakPoints) && diff >= 2) {
    if (side === 'a') {
      state.currentSet.a += 1;
    } else {
      state.currentSet.b += 1;
    }

    // After tie-break set, next set starts with opposite server of tie-break opener.
    state.server = opposite(state.tieBreak.firstServer);
    finalizeSet(state);
  }
}

function pushHistory(next, prev) {
  next.history = [...prev.history, withoutHistory(prev)].slice(-300);
}

export function addPoint(prev, side) {
  const next = clone(prev);
  if (next.winner) {
    return next;
  }

  pushHistory(next, prev);
  next.sideChangeAlert = false;

  if (next.tieBreak.active) {
    winTieBreakPoint(next, side);
    return next;
  }

  if (side === 'a') {
    next.points.a += 1;
  } else {
    next.points.b += 1;
  }

  if (shouldWinGame(next.points.a, next.points.b, next.config.puntoDeOro)) {
    winGame(next, side);
  }

  return next;
}

export function undoPoint(prev) {
  if (!prev.history.length) {
    return prev;
  }

  const previous = prev.history[prev.history.length - 1];
  const restored = clone(previous);
  restored.history = prev.history.slice(0, -1);
  return restored;
}

export function setPuntoDeOro(prev, value) {
  const next = clone(prev);
  next.config.puntoDeOro = Boolean(value);
  return next;
}

export function setInitialServer(prev, side) {
  const next = clone(prev);
  next.server = side;
  if (next.tieBreak.active) {
    next.tieBreak.firstServer = side;
  }
  return next;
}

export function resetScore(config = {}) {
  return createScoreState(config);
}

function formatClassicPoint(points, other, puntoDeOro) {
  const map = [0, 15, 30, 40];
  if (points >= 3 && other >= 3) {
    if (puntoDeOro) {
      return '40';
    }

    if (points === other) {
      return '40';
    }
    return points > other ? 'AV' : '40';
  }

  return String(map[Math.min(points, 3)]);
}

export function getDisplayPoints(state) {
  if (state.tieBreak.active) {
    return {
      a: String(state.tieBreak.a),
      b: String(state.tieBreak.b),
      tieBreak: true,
    };
  }

  return {
    a: formatClassicPoint(state.points.a, state.points.b, state.config.puntoDeOro),
    b: formatClassicPoint(state.points.b, state.points.a, state.config.puntoDeOro),
    tieBreak: false,
  };
}

export function getCurrentServer(state) {
  if (!state.tieBreak.active) {
    return state.server;
  }

  const totalPoints = state.tieBreak.a + state.tieBreak.b;
  return tieBreakServer(state.tieBreak.firstServer, totalPoints);
}

export function scoreStateToSets(state) {
  const out = [...state.sets];
  if (state.winner) {
    return out;
  }

  if (state.currentSet.a > 0 || state.currentSet.b > 0) {
    out.push({ a: state.currentSet.a, b: state.currentSet.b });
  }
  return out;
}
