import { evaluateMatch } from '../engine/matchEngine.js';
import { store } from '../store/index.js';

function pairKey(team) {
  return [...team].sort().join(':');
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function buildTeamPlayers(ids) {
  const users = await Promise.all(ids.map((id) => store.getUserById(id)));
  if (users.some((u) => !u)) {
    throw new Error('One or more players do not exist');
  }
  return users;
}

export async function createMatch(payload, createdBy) {
  const teamA = payload.teamA ?? [];
  const teamB = payload.teamB ?? [];

  if (teamA.length !== 2 || teamB.length !== 2) {
    throw new Error('A padel match requires exactly 2 players per team');
  }

  const allPlayers = [...teamA, ...teamB];
  const unique = new Set(allPlayers);
  if (unique.size !== 4) {
    throw new Error('Players must be unique');
  }

  if (!allPlayers.includes(createdBy)) {
    throw new Error('Creator must be one of the match players');
  }

  const usersA = await buildTeamPlayers(teamA);
  const usersB = await buildTeamPlayers(teamB);

  const billing = {
    clubName: payload.clubName ?? 'Unknown club',
    totalCostEur: Number(payload.totalCostEur ?? 0),
  };

  const splitCost = Number((billing.totalCostEur / 4).toFixed(2));

  return store.createMatch({
    createdBy,
    teamA,
    teamB,
    players: allPlayers,
    sets: payload.sets ?? [],
    goldenPoints: payload.goldenPoints ?? { teamA: 0, teamB: 0 },
    billing: {
      ...billing,
      splitCostEurPerPlayer: splitCost,
    },
    validation: {
      required: 3,
      accepted: 0,
      rejected: 0,
      pendingValidators: allPlayers.filter((id) => id !== createdBy),
    },
    rated: false,
    usersSnapshot: {
      teamA: usersA.map((u) => safeUser(u)),
      teamB: usersB.map((u) => safeUser(u)),
    },
  });
}

export async function validateMatch({ matchId, userId, accepted }) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (![...match.teamA, ...match.teamB].includes(userId)) {
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

  if (rejectedCount >= 2) {
    return store.updateMatch(matchId, {
      status: 'rejected',
    });
  }

  if (acceptedCount >= 2 && !updated.rated) {
    return rateValidatedMatch(matchId);
  }

  return updated;
}

async function userToEnginePlayer(user, partnerId) {
  const pair = [user.id, partnerId].sort();
  const pairRating = await store.getPairRating(pair.join(':')) ?? user.rating;

  return {
    id: user.id,
    rating: user.rating,
    pairRating,
    watch: {
      distanceKm: 0,
      calories: 0,
      intensityScore: 0,
      smashSpeedKmh: 0,
    },
    winners: 0,
    directErrors: 0,
    fairPlayScore: 3,
  };
}

export async function rateValidatedMatch(matchId) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const [a1, a2] = await Promise.all(match.teamA.map((id) => store.getUserById(id)));
  const [b1, b2] = await Promise.all(match.teamB.map((id) => store.getUserById(id)));

  const result = evaluateMatch({
    sets: match.sets,
    goldenPoints: match.goldenPoints,
    teamA: [
      await userToEnginePlayer(a1, a2.id),
      await userToEnginePlayer(a2, a1.id),
    ],
    teamB: [
      await userToEnginePlayer(b1, b2.id),
      await userToEnginePlayer(b2, b1.id),
    ],
  });

  for (const update of [...result.teamA, ...result.teamB]) {
    const current = await store.getUserById(update.id);
    await store.updateUser(update.id, {
      rating: update.newRating,
      pir: update.pir.pir,
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

  const pairAKey = pairKey(match.teamA);
  const pairBKey = pairKey(match.teamB);

  await store.upsertPairRating(pairAKey, result.teamA.reduce((s, p) => s + p.pairRatingAfter, 0) / 2);
  await store.upsertPairRating(pairBKey, result.teamB.reduce((s, p) => s + p.pairRatingAfter, 0) / 2);

  return store.updateMatch(matchId, {
    status: 'validated',
    rated: true,
    ratingResult: result,
    validatedAt: new Date().toISOString(),
  });
}

export async function getMatch(matchId) {
  const match = await store.getMatch(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  return {
    ...match,
    validations: await store.listValidations(matchId),
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
      && !hasVoted;

    enriched.push({
      ...match,
      validations,
      canValidate,
    });
  }

  const filtered = status
    ? enriched.filter((match) => match.status === status)
    : enriched;

  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
