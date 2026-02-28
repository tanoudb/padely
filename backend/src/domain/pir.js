import { clamp, round } from './math.js';

export const DEFAULT_BASELINE_RATING = 1200;

export function winProbability(teamARating, teamBRating) {
  return 1 / (1 + 10 ** ((teamBRating - teamARating) / 400));
}

export function computeDominationMultiplier(sets) {
  const totalGames = sets.reduce((sum, set) => sum + set.a + set.b, 0);
  const gameDiff = Math.abs(sets.reduce((sum, set) => sum + (set.a - set.b), 0));
  if (totalGames === 0) {
    return 1;
  }

  const dominationRatio = gameDiff / totalGames;
  return round(1 + clamp(dominationRatio * 0.6, 0, 0.35), 3);
}

export function computeClutchBonus(teamGoldenWon, totalGolden) {
  if (totalGolden <= 0) {
    return 0;
  }

  const ratio = teamGoldenWon / totalGolden;
  return round(clamp(ratio * 3, 0, 3), 2);
}

export function computeCombativiteBonus({
  isUnderdog,
  lostBySmallMargin,
  distanceKm = 0,
  calories = 0,
  intensityScore = 0,
}) {
  if (!isUnderdog || !lostBySmallMargin) {
    return 0;
  }

  const distanceFactor = clamp(distanceKm / 4, 0, 1);
  const calorieFactor = clamp(calories / 900, 0, 1);
  const intensityFactor = clamp(intensityScore / 100, 0, 1);

  return round((distanceFactor * 0.3 + calorieFactor * 0.4 + intensityFactor * 0.3) * 5, 2);
}

export function computeLeadershipBonus(playerRating, partnerRating, didWin) {
  if (!didWin) {
    return 0;
  }

  const delta = playerRating - partnerRating;
  if (delta >= 350) {
    return 2;
  }

  if (delta <= -350) {
    return 4;
  }

  return 0;
}

export function computePairExpected(pairRating, opponentPairRating) {
  return winProbability(pairRating, opponentPairRating);
}

export function computePairDelta({
  pairRating,
  opponentPairRating,
  didWin,
  kFactor = 18,
}) {
  const expected = computePairExpected(pairRating, opponentPairRating);
  const actual = didWin ? 1 : 0;
  return round(kFactor * (actual - expected), 2);
}

export function softReset(rating, baseline = DEFAULT_BASELINE_RATING, compression = 0.15) {
  const adjusted = baseline + (rating - baseline) * (1 - compression);
  return round(adjusted, 2);
}

export function inactivityDecay({
  rating,
  weeksInactive,
  graceWeeks = 3,
  pointsPerWeek = 6,
  minRating = 700,
}) {
  if (weeksInactive <= graceWeeks) {
    return rating;
  }

  const decayWeeks = weeksInactive - graceWeeks;
  const decayed = rating - decayWeeks * pointsPerWeek;
  return round(Math.max(minRating, decayed), 2);
}

export function computePillars({
  smashSpeedKmh = 0,
  distanceKm = 0,
  calories = 0,
  winners = 0,
  directErrors = 0,
  clutchRatio = 0,
  fairPlayScore = 3,
}) {
  const power = clamp(smashSpeedKmh / 2, 0, 100);
  const stamina = clamp((distanceKm / 5) * 60 + (calories / 900) * 40, 0, 100);

  const totalShots = winners + directErrors;
  const consistency = totalShots === 0
    ? 50
    : clamp((winners / totalShots) * 100, 0, 100);

  const clutch = clamp(clutchRatio * 100, 0, 100);
  const social = clamp((fairPlayScore / 5) * 100, 0, 100);

  const pir = round((power + stamina + consistency + clutch + social) / 5, 2);

  return {
    pir,
    pillars: {
      power: round(power, 2),
      stamina: round(stamina, 2),
      consistency: round(consistency, 2),
      clutch: round(clutch, 2),
      social: round(social, 2),
    },
  };
}
