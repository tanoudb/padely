import {
  winProbability,
  computeCalibrationKFactor,
  computeClutchBonus,
  computeCombativiteBonus,
  computeDominationMultiplier,
  computeLeadershipBonus,
  computeLossProtection,
  computeMomentumFactor,
  computePairDelta,
  computePillars,
  computeStreakMultiplier,
  computeUpsetBonus,
} from '../domain/pir.js';
import { round } from '../domain/math.js';

function averageRating(players) {
  return players.reduce((sum, player) => sum + player.rating, 0) / players.length;
}

function gamesWon(sets, side) {
  return sets.reduce((sum, set) => sum + set[side], 0);
}

function matchWinner(sets) {
  let teamASets = 0;
  let teamBSets = 0;

  for (const set of sets) {
    if (set.a > set.b) {
      teamASets += 1;
    } else if (set.b > set.a) {
      teamBSets += 1;
    }
  }

  return teamASets >= teamBSets ? 'A' : 'B';
}

function closeLoss(sets) {
  const margin = Math.abs(gamesWon(sets, 'a') - gamesWon(sets, 'b'));
  return margin <= 3;
}

function gameDifference(sets, team) {
  const own = gamesWon(sets, team === 'A' ? 'a' : 'b');
  const opp = gamesWon(sets, team === 'A' ? 'b' : 'a');
  return own - opp;
}

export function evaluateMatch(payload) {
  const winner = matchWinner(payload.sets);
  const teamARating = averageRating(payload.teamA);
  const teamBRating = averageRating(payload.teamB);

  const expectedA = winProbability(teamARating, teamBRating);
  const expectedB = 1 - expectedA;

  const didAWin = winner === 'A';
  const domination = computeDominationMultiplier(payload.sets);

  const totalGolden = (payload.goldenPoints?.teamA ?? 0) + (payload.goldenPoints?.teamB ?? 0);
  const clutchA = computeClutchBonus(payload.goldenPoints?.teamA ?? 0, totalGolden);
  const clutchB = computeClutchBonus(payload.goldenPoints?.teamB ?? 0, totalGolden);

  const aUnderdog = teamARating < teamBRating;
  const bUnderdog = teamBRating < teamARating;
  const isCloseLoss = closeLoss(payload.sets);

  const updatePlayer = ({
    player,
    partner,
    expected,
    didTeamWin,
    teamUnderdog,
    clutchTeamBonus,
  }) => {
    const baseK = computeCalibrationKFactor({
      matchesPlayed: player.calibration?.matchesPlayed ?? 0,
      minK: 24,
      maxK: player.kFactor ?? 40,
      calibrationMatches: 10,
    });
    const actual = didTeamWin ? 1 : 0;
    const streakMultiplier = computeStreakMultiplier({
      currentWinStreak: player.form?.currentWinStreak ?? 0,
      didWin: didTeamWin,
    });
    const momentumFactor = computeMomentumFactor({
      formIndex: player.form?.formIndex ?? 0,
      didWin: didTeamWin,
    });
    const baseDelta = baseK * domination * streakMultiplier * momentumFactor * (actual - expected);
    const clutchDelta = didTeamWin ? clutchTeamBonus : 0;
    const leadershipDelta = computeLeadershipBonus(player.rating, partner.rating, didTeamWin);
    const upsetDelta = computeUpsetBonus({
      playerTeamRating: expected === expectedA ? teamARating : teamBRating,
      opponentTeamRating: expected === expectedA ? teamBRating : teamARating,
      didWin: didTeamWin,
    });
    const lossProtection = computeLossProtection({
      expectedWin: expected,
      didWin: didTeamWin,
      gameDiff: gameDifference(payload.sets, expected === expectedA ? 'A' : 'B'),
    });

    const combativiteDelta = computeCombativiteBonus({
      isUnderdog: teamUnderdog,
      lostBySmallMargin: !didTeamWin && isCloseLoss,
      distanceKm: player.watch?.distanceKm ?? 0,
      calories: player.watch?.calories ?? 0,
      intensityScore: player.watch?.intensityScore ?? 0,
    });

    const totalDelta = round(baseDelta + clutchDelta + leadershipDelta + upsetDelta + combativiteDelta + lossProtection, 2);

    const pairRating = player.pairRating ?? player.rating;
    const opponentPairRating = expected === expectedA ? teamBRating : teamARating;
    const pairDelta = computePairDelta({
      pairRating,
      opponentPairRating,
      didWin: didTeamWin,
    });

    const clutchRatio = totalGolden > 0
      ? (didTeamWin ? (clutchTeamBonus / 3) : 0)
      : 0;

    const analytics = computePillars({
      smashSpeedKmh: player.watch?.smashSpeedKmh ?? 0,
      distanceKm: player.watch?.distanceKm ?? 0,
      calories: player.watch?.calories ?? 0,
      intensityScore: player.watch?.intensityScore ?? 0,
      heartRateAvg: player.watch?.heartRateAvg ?? 0,
      oxygenAvg: player.watch?.oxygenAvg ?? 0,
      winners: player.winners ?? 0,
      directErrors: player.directErrors ?? 0,
      clutchRatio,
      fairPlayScore: player.fairPlayScore ?? 3,
    });

    return {
      id: player.id,
      previousRating: player.rating,
      newRating: round(player.rating + totalDelta, 2),
      delta: totalDelta,
      breakdown: {
        base: round(baseDelta, 2),
        baseK,
        dominationMultiplier: domination,
        streakMultiplier,
        momentumFactor,
        formIndex: round(player.form?.formIndex ?? 0, 3),
        preMatchWinStreak: player.form?.currentWinStreak ?? 0,
        clutch: clutchDelta,
        leadership: leadershipDelta,
        upset: upsetDelta,
        lossProtection,
        combativite: combativiteDelta,
      },
      pairRatingBefore: pairRating,
      pairRatingAfter: round(pairRating + pairDelta, 2),
      pairDelta,
      pir: analytics,
    };
  };

  const teamAUpdates = payload.teamA.map((player, index, team) => updatePlayer({
    player,
    partner: team[index === 0 ? 1 : 0],
    expected: expectedA,
    didTeamWin: didAWin,
    teamUnderdog: aUnderdog,
    clutchTeamBonus: clutchA,
  }));

  const teamBUpdates = payload.teamB.map((player, index, team) => updatePlayer({
    player,
    partner: team[index === 0 ? 1 : 0],
    expected: expectedB,
    didTeamWin: !didAWin,
    teamUnderdog: bUnderdog,
    clutchTeamBonus: clutchB,
  }));

  return {
    summary: {
      winner,
      expectedA: round(expectedA, 3),
      expectedB: round(expectedB, 3),
      domination,
      closeLoss: isCloseLoss,
    },
    teamA: teamAUpdates,
    teamB: teamBUpdates,
  };
}
