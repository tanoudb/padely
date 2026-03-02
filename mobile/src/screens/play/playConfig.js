export function scoreConfigFromSetup(setup = {}) {
  const pointRule = setup.pointRule ?? 'punto_de_oro';
  const matchFormat = setup.matchFormat ?? 'marathon';
  const puntoDeOro = pointRule !== 'avantage';

  if (matchFormat === 'standard') {
    return {
      puntoDeOro,
      setsToWin: 2,
      gamesToWinSet: 6,
      tieBreakAtGames: 6,
      tieBreakPoints: 7,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'full_set',
      superTieBreakPoints: 10,
    };
  }

  if (matchFormat === 'club') {
    return {
      puntoDeOro,
      setsToWin: 2,
      gamesToWinSet: 6,
      tieBreakAtGames: 6,
      tieBreakPoints: 7,
      noTieBreakInDecidingSet: false,
      decidingSetMode: 'super_tiebreak',
      superTieBreakPoints: 10,
    };
  }

  return {
    puntoDeOro,
    setsToWin: 3,
    gamesToWinSet: 4,
    tieBreakAtGames: 3,
    tieBreakPoints: 7,
    noTieBreakInDecidingSet: false,
    decidingSetMode: 'full_set',
    superTieBreakPoints: 10,
  };
}

export function slotToApiPlayer(slot) {
  if (!slot) return null;
  if (typeof slot === 'string') return slot;
  if (slot.kind === 'guest') {
    return {
      kind: 'guest',
      guestId: slot.guestId,
      guestName: slot.guestName,
      guestLevel: slot.guestLevel,
    };
  }
  return null;
}

export function slotDisplayName(slot, participants = {}) {
  if (!slot) return 'Joueur';
  if (typeof slot === 'string') {
    const participant = participants[slot];
    if (participant && typeof participant === 'object') {
      return participant.displayName ?? participant.name ?? 'Joueur';
    }
    if (typeof participant === 'string') {
      return participant;
    }
    return 'Joueur';
  }
  if (slot.kind === 'guest') return slot.guestName ?? 'Invite';
  return 'Joueur';
}
