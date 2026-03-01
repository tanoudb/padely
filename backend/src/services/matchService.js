import { evaluateMatch } from '../engine/matchEngine.js';
import { store } from '../store/index.js';
import { newToken } from '../utils/security.js';
import { newId } from '../utils/id.js';

function pairKey(team) {
  return [...team].sort().join(':');
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function ratingFromLevel(level) {
  if (typeof level === 'number') {
    if (level <= 2) return 800;
    if (level <= 4) return 1200;
    if (level <= 5) return 1500;
    if (level <= 6) return 1800;
    if (level <= 7) return 2100;
    return 2400;
  }

  const text = String(level ?? '').toLowerCase();
  if (text.includes('debut')) return 1000;
  if (text.includes('inter')) return 1300;
  if (text.includes('conf')) return 1600;
  return 1200;
}

function sanitizeWatchMetrics(input = {}) {
  return {
    distanceKm: Number(input.distanceKm ?? 0) || 0,
    calories: Number(input.calories ?? 0) || 0,
    intensityScore: Number(input.intensityScore ?? 0) || 0,
    smashSpeedKmh: Number(input.smashSpeedKmh ?? 0) || 0,
    heartRateAvg: Number(input.heartRateAvg ?? 0) || 0,
    oxygenAvg: Number(input.oxygenAvg ?? 0) || 0,
  };
}

function parseParticipantSlot(slot) {
  if (typeof slot === 'string') {
    return {
      kind: 'user',
      userId: slot,
      id: slot,
    };
  }

  if (!slot || typeof slot !== 'object') {
    throw new Error('Invalid participant slot');
  }

  if (slot.userId) {
    return {
      kind: 'user',
      userId: slot.userId,
      id: slot.userId,
    };
  }

  const isGuest = slot.kind === 'guest' || slot.type === 'guest' || slot.guest === true;
  if (!isGuest) {
    throw new Error('Unsupported participant type');
  }

  const guestName = (slot.guestName ?? slot.name ?? 'Invite').trim();
  const guestLevel = slot.guestLevel ?? slot.level ?? 'Intermediaire';
  const guestId = slot.guestId ?? newId('gst');

  return {
    kind: 'guest',
    guestId,
    id: guestId,
    guestName,
    guestLevel,
    guestRating: ratingFromLevel(guestLevel),
  };
}

function normalizeTeams(teamAInput, teamBInput) {
  const teamA = (teamAInput ?? []).map(parseParticipantSlot);
  const teamB = (teamBInput ?? []).map(parseParticipantSlot);
  if (teamA.length !== 2 || teamB.length !== 2) {
    throw new Error('A padel match requires exactly 2 players per team');
  }
  return { teamA, teamB };
}

function extractUserIds(teamA, teamB) {
  return [...teamA, ...teamB].filter((p) => p.kind === 'user').map((p) => p.userId);
}

async function buildUsersById(ids) {
  const map = new Map();
  const users = await Promise.all(ids.map((id) => store.getUserById(id)));
  users.forEach((user, index) => {
    if (!user) {
      throw new Error(`Player not found: ${ids[index]}`);
    }
    map.set(ids[index], user);
  });
  return map;
}

function slotSnapshot(slot, usersById) {
  if (slot.kind === 'user') {
    return safeUser(usersById.get(slot.userId));
  }

  return {
    id: slot.guestId,
    displayName: slot.guestName,
    rating: slot.guestRating,
    guest: true,
    guestLevel: slot.guestLevel,
  };
}

function slotWatch(slot, watchByPlayer) {
  const key = slot.kind === 'user' ? slot.userId : slot.guestId;
  return sanitizeWatchMetrics(watchByPlayer[key] ?? {});
}

function participantsForMatch(match, teamKey) {
  const fromParticipants = match.participants?.[teamKey];
  if (Array.isArray(fromParticipants) && fromParticipants.length === 2) {
    return fromParticipants;
  }

  return (match[teamKey] ?? []).map((id) => ({
    kind: 'user',
    userId: id,
    id,
  }));
}

function teamIsFullyRegistered(teamSlots) {
  return teamSlots.every((slot) => slot.kind === 'user');
}

function userTeamContains(match, userId) {
  return (match.players ?? []).includes(userId)
    || (match.teamA ?? []).includes(userId)
    || (match.teamB ?? []).includes(userId);
}

function createEnginePlayer(slot, watch, usersById, partnerSlot, pairRating) {
  if (slot.kind === 'guest') {
    return {
      id: `guest:${slot.guestId}`,
      rating: slot.guestRating,
      pairRating: slot.guestRating,
      kFactor: 0,
      watch,
      winners: 0,
      directErrors: 0,
      fairPlayScore: 3,
      isGuest: true,
    };
  }

  const user = usersById.get(slot.userId);
  const remaining = user.calibration?.remainingMatches ?? 0;
  const partnerRating = partnerSlot.kind === 'user'
    ? usersById.get(partnerSlot.userId).rating
    : partnerSlot.guestRating;

  return {
    id: user.id,
    rating: user.rating,
    pairRating: pairRating ?? ((user.rating + partnerRating) / 2),
    kFactor: remaining > 0 ? 40 : 24,
    watch,
    winners: 0,
    directErrors: 0,
    fairPlayScore: 3,
    isGuest: false,
  };
}

function normalizeMatchFormat(value) {
  const format = String(value ?? '').toLowerCase();
  if (format === 'club' || format === 'marathon' || format === 'standard') {
    return format;
  }
  return 'standard';
}

function scoringRulesForFormat(matchFormat) {
  if (matchFormat === 'club') {
    return {
      setsToWin: 2,
      gamesToWinSet: 6,
      tieBreakAt: 6,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'super_tiebreak',
    };
  }

  if (matchFormat === 'marathon') {
    return {
      setsToWin: 3,
      gamesToWinSet: 4,
      tieBreakAt: 3,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'full_set',
    };
  }

  return {
    setsToWin: 2,
    gamesToWinSet: 6,
    tieBreakAt: 6,
    noTieBreakInDecidingSet: false,
    decidingSetMode: 'full_set',
  };
}

function winnerOfSet(set) {
  if (set.a > set.b) return 'A';
  if (set.b > set.a) return 'B';
  return null;
}

function validateSetShape(set, index) {
  if (!set || typeof set !== 'object') {
    throw new Error(`Set ${index + 1} is invalid`);
  }

  const a = Number(set.a);
  const b = Number(set.b);

  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    throw new Error(`Set ${index + 1} must use non-negative integer games`);
  }

  if (a === b) {
    throw new Error(`Set ${index + 1} cannot end in a draw`);
  }
}

function isValidSetScore(set, { gamesToWinSet, tieBreakAt, tieBreakEnabled }) {
  const winnerGames = Math.max(set.a, set.b);
  const loserGames = Math.min(set.a, set.b);
  const diff = winnerGames - loserGames;

  if (tieBreakEnabled) {
    const regularWin = winnerGames === gamesToWinSet && loserGames <= gamesToWinSet - 2 && diff >= 2;
    const tieBreakWin = winnerGames === (tieBreakAt + 1) && loserGames === tieBreakAt;
    return regularWin || tieBreakWin;
  }

  return winnerGames >= gamesToWinSet && diff >= 2;
}

function validateSetsByFormat(sets, matchFormat) {
  if (!Array.isArray(sets) || sets.length === 0) {
    throw new Error('At least one completed set is required');
  }

  const rules = scoringRulesForFormat(matchFormat);
  const maxSets = (rules.setsToWin * 2) - 1;
  if (sets.length > maxSets) {
    throw new Error(`Too many sets for format ${matchFormat}`);
  }

  let setsWonA = 0;
  let setsWonB = 0;

  for (let index = 0; index < sets.length; index += 1) {
    if (setsWonA >= rules.setsToWin || setsWonB >= rules.setsToWin) {
      throw new Error('Extra sets were provided after match winner was already decided');
    }

    const set = sets[index];
    validateSetShape(set, index);

    const decidingSetIndex = maxSets - 1;
    const isDecidingSet = index === decidingSetIndex;

    if (isDecidingSet && rules.decidingSetMode === 'super_tiebreak') {
      const winnerGames = Math.max(set.a, set.b);
      const loserGames = Math.min(set.a, set.b);
      if (!(winnerGames === 1 && loserGames === 0)) {
        throw new Error(`Set ${index + 1} must be recorded as 1-0 or 0-1 in super tie-break mode`);
      }
    } else {
      const tieBreakEnabled = !(rules.noTieBreakInDecidingSet && isDecidingSet);
      if (!isValidSetScore(set, {
        gamesToWinSet: rules.gamesToWinSet,
        tieBreakAt: rules.tieBreakAt,
        tieBreakEnabled,
      })) {
        if (rules.gamesToWinSet === 4) {
          throw new Error(`Set ${index + 1} is invalid for short-set rules (3-3 must go to tie-break, final set score 4-3)`);
        }
        throw new Error(`Set ${index + 1} is invalid for format ${matchFormat}`);
      }
    }

    const setWinner = winnerOfSet(set);
    if (setWinner === 'A') {
      setsWonA += 1;
    } else if (setWinner === 'B') {
      setsWonB += 1;
    }
  }

  if (setsWonA < rules.setsToWin && setsWonB < rules.setsToWin) {
    throw new Error('Provided sets do not contain a finished match winner');
  }
}

function containsGuest(teamSlots) {
  return teamSlots.some((slot) => slot.kind === 'guest');
}

function findPlayerUpdateById(ratingResult, userId) {
  return [...(ratingResult?.teamA ?? []), ...(ratingResult?.teamB ?? [])]
    .find((item) => item.id === userId);
}

function toSigned(value) {
  const num = Number(value ?? 0);
  if (num > 0) return `+${num.toFixed(2)}`;
  return num.toFixed(2);
}

function buildPirImpact(match, userId) {
  if (!match?.ratingResult || match.mode !== 'ranked') {
    return null;
  }

  const update = findPlayerUpdateById(match.ratingResult, userId);
  if (!update) {
    return null;
  }

  const reasons = [
    `Base: ${toSigned(update.breakdown?.base)}`,
    `Domination: x${Number(update.breakdown?.dominationMultiplier ?? 1).toFixed(2)}`,
    `Clutch: ${toSigned(update.breakdown?.clutch)}`,
    `Combativite: ${toSigned(update.breakdown?.combativite)}`,
    `Upset: ${toSigned(update.breakdown?.upset)}`,
    `Leadership: ${toSigned(update.breakdown?.leadership)}`,
    `Protection defaite: ${toSigned(update.breakdown?.lossProtection)}`,
  ];

  return {
    delta: update.delta,
    before: update.previousRating,
    after: update.newRating,
    pir: update.pir?.pir ?? null,
    pairDelta: update.pairDelta,
    reasons,
    breakdown: update.breakdown ?? {},
  };
}

export async function createMatch(payload, createdBy) {
  const { teamA, teamB } = normalizeTeams(payload.teamA, payload.teamB);
  const matchFormat = normalizeMatchFormat(payload.matchFormat);
  validateSetsByFormat(payload.sets, matchFormat);
  const userIds = extractUserIds(teamA, teamB);
  const mode = payload.mode === 'friendly' ? 'friendly' : 'ranked';

  if (!userIds.includes(createdBy)) {
    throw new Error('Creator must be one of the match players');
  }

  if (mode === 'ranked' && (containsGuest(teamA) || containsGuest(teamB))) {
    throw new Error('Ranked mode only accepts registered players');
  }

  const uniqueUsers = new Set(userIds);
  if (uniqueUsers.size !== userIds.length) {
    throw new Error('Players must be unique');
  }

  const usersById = await buildUsersById(userIds);
  const watchByPlayerInput = payload.watchByPlayer ?? {};
  const watchByPlayer = {};
  for (const slot of [...teamA, ...teamB]) {
    const key = slot.kind === 'user' ? slot.userId : slot.guestId;
    watchByPlayer[key] = slotWatch(slot, watchByPlayerInput);
  }

  const billing = {
    clubName: payload.clubName ?? 'Unknown club',
    totalCostEur: Number(payload.totalCostEur ?? 0),
  };

  const splitCost = Number((billing.totalCostEur / 4).toFixed(2));
  const validationMode = mode === 'ranked' ? 'cross' : 'friendly';
  const rawPendingValidators = mode === 'friendly' ? [] : userIds.filter((id) => id !== createdBy);
  const requiredValidations = mode === 'friendly' ? 0 : rawPendingValidators.length;
  const pendingValidators = rawPendingValidators;

  const created = await store.createMatch({
    createdBy,
    mode,
    isRated: mode !== 'friendly',
    teamA: teamA.map((slot) => slot.id),
    teamB: teamB.map((slot) => slot.id),
    participants: {
      teamA,
      teamB,
    },
    players: userIds,
    matchFormat,
    sets: payload.sets ?? [],
    goldenPoints: payload.goldenPoints ?? { teamA: 0, teamB: 0 },
    watchByPlayer,
    billing: {
      ...billing,
      splitCostEurPerPlayer: splitCost,
    },
    validation: {
      required: requiredValidations,
      accepted: 0,
      rejected: 0,
      pendingValidators,
    },
    validationMode,
    rated: false,
    usersSnapshot: {
      teamA: teamA.map((slot) => slotSnapshot(slot, usersById)),
      teamB: teamB.map((slot) => slotSnapshot(slot, usersById)),
    },
  });

  if (mode === 'friendly') {
    return store.updateMatch(created.id, {
      status: 'validated',
      rated: false,
      validation: {
        ...created.validation,
        accepted: 0,
      },
      validatedAt: new Date().toISOString(),
    });
  }

  if (requiredValidations === 0) {
    return rateValidatedMatch(created.id);
  }

  return created;
}

export async function validateMatch({ matchId, userId, accepted }) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.mode === 'friendly') {
    return match;
  }

  if (!userTeamContains(match, userId)) {
    throw new Error('User not in match');
  }

  if (userId === match.createdBy) {
    throw new Error('Creator cannot self-validate');
  }

  if (match.status !== 'pending_validation') {
    return match;
  }

  const existing = (await store.listValidations(matchId)).find((v) => v.userId === userId);
  if (existing) {
    throw new Error('Validation already sent by this user');
  }

  await store.createValidation({ matchId, userId, accepted: Boolean(accepted) });
  const validations = await store.listValidations(matchId);

  const acceptedCount = validations.filter((v) => v.accepted).length;
  const rejectedCount = validations.filter((v) => !v.accepted).length;

  const updated = await store.updateMatch(matchId, {
    validation: {
      ...match.validation,
      accepted: acceptedCount,
      rejected: rejectedCount,
      pendingValidators: match.validation.pendingValidators.filter((id) => id !== userId),
    },
  });

  if (rejectedCount >= 1) {
    return store.updateMatch(matchId, {
      status: 'rejected',
    });
  }

  if (acceptedCount >= updated.validation.required && !updated.rated) {
    return rateValidatedMatch(matchId);
  }

  return updated;
}

export async function rateValidatedMatch(matchId) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.mode === 'friendly' || match.isRated === false) {
    return store.updateMatch(matchId, {
      status: 'validated',
      rated: false,
      ratingResult: null,
      validatedAt: new Date().toISOString(),
    });
  }

  const teamASlots = participantsForMatch(match, 'teamA');
  const teamBSlots = participantsForMatch(match, 'teamB');

  const userIds = extractUserIds(teamASlots, teamBSlots);
  const usersById = await buildUsersById(userIds);
  const watchByPlayer = match.watchByPlayer ?? {};

  const teamAIds = teamASlots.filter((s) => s.kind === 'user').map((s) => s.userId);
  const teamBIds = teamBSlots.filter((s) => s.kind === 'user').map((s) => s.userId);
  const pairAKey = teamAIds.length === 2 ? pairKey(teamAIds) : null;
  const pairBKey = teamBIds.length === 2 ? pairKey(teamBIds) : null;
  const pairARating = pairAKey ? (await store.getPairRating(pairAKey)) : null;
  const pairBRating = pairBKey ? (await store.getPairRating(pairBKey)) : null;

  const teamA = teamASlots.map((slot, index, team) => createEnginePlayer(
    slot,
    slotWatch(slot, watchByPlayer),
    usersById,
    team[index === 0 ? 1 : 0],
    pairARating,
  ));
  const teamB = teamBSlots.map((slot, index, team) => createEnginePlayer(
    slot,
    slotWatch(slot, watchByPlayer),
    usersById,
    team[index === 0 ? 1 : 0],
    pairBRating,
  ));

  const result = evaluateMatch({
    sets: match.sets,
    goldenPoints: match.goldenPoints,
    teamA,
    teamB,
  });

  for (const update of [...result.teamA, ...result.teamB]) {
    if (String(update.id).startsWith('guest:')) {
      continue;
    }

    const current = await store.getUserById(update.id);
    if (!current) {
      continue;
    }

    const remainingCalibration = current.calibration?.remainingMatches ?? 0;
    await store.updateUser(update.id, {
      rating: update.newRating,
      pir: update.pir.pir,
      calibration: {
        remainingMatches: Math.max(0, remainingCalibration - 1),
      },
      history: [
        ...(current.history ?? []),
        {
          at: new Date().toISOString(),
          rating: update.newRating,
          delta: update.delta,
          pir: update.pir.pir,
          matchId,
        },
      ].slice(-60),
    });
  }

  if (pairAKey && teamIsFullyRegistered(teamASlots)) {
    await store.upsertPairRating(pairAKey, result.teamA.reduce((s, p) => s + p.pairRatingAfter, 0) / 2);
  }
  if (pairBKey && teamIsFullyRegistered(teamBSlots)) {
    await store.upsertPairRating(pairBKey, result.teamB.reduce((s, p) => s + p.pairRatingAfter, 0) / 2);
  }

  return store.updateMatch(matchId, {
    status: 'validated',
    rated: true,
    ratingResult: result,
    validatedAt: new Date().toISOString(),
  });
}

export async function createPostMatchInvite(matchId, userId) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }
  if (!userTeamContains(match, userId)) {
    throw new Error('User not in match');
  }

  const token = newToken();
  const invite = {
    token,
    matchId,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    url: `https://padely.app/invite?match=${encodeURIComponent(matchId)}&token=${encodeURIComponent(token)}`,
  };

  const previous = match.invites ?? [];
  await store.updateMatch(matchId, {
    invites: [invite, ...previous].slice(0, 20),
  });

  return invite;
}

export async function getMatch(matchId) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  return {
    ...match,
    validations: await store.listValidations(matchId),
    pirImpactByPlayer: Object.fromEntries(
      (match.players ?? []).map((playerId) => [playerId, buildPirImpact(match, playerId)]),
    ),
  };
}

export async function listMatchesForUser(userId, { status } = {}) {
  const matches = await store.listMatchesForUser(userId);
  const enriched = [];

  for (const match of matches) {
    const validations = await store.listValidations(match.id);
    const hasVoted = validations.some((v) => v.userId === userId);
    const canValidate = match.status === 'pending_validation'
      && userId !== match.createdBy
      && !hasVoted
      && match.mode !== 'friendly';

    enriched.push({
      ...match,
      validations,
      canValidate,
      pirImpact: buildPirImpact(match, userId),
    });
  }

  const filtered = status
    ? enriched.filter((match) => match.status === status)
    : enriched;

  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
