function extractProfile(raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  if (raw.playerProfile && typeof raw.playerProfile === 'object') {
    return raw.playerProfile;
  }
  return raw;
}

export function getContextualMessage(playerProfilePayload, t) {
  const profile = extractProfile(playerProfilePayload);
  const contextual = playerProfilePayload?.contextualMessage ?? null;

  if (contextual?.type === 'comeback') {
    const days = Number(contextual?.days ?? profile?.comebackMode?.daysSinceLastMatch ?? 0);
    return {
      title: t('home.comebackTitle', { days }),
      subtitle: t('home.comebackSub'),
      tone: 'comeback',
    };
  }

  if (contextual?.type === 'rivalry_never_beaten') {
    return {
      title: t('profile.neverBeaten', {
        name: contextual?.opponentName ?? '',
        count: contextual?.count ?? 0,
      }),
      subtitle: t('profile.newRival'),
      tone: 'rivalry',
    };
  }

  if (contextual?.type === 'key_match') {
    return {
      title: t('match.keyMatch'),
      subtitle: contextual?.score ?? '',
      tone: 'key',
    };
  }

  if (contextual?.type === 'streak') {
    return {
      title: t('home.streakTitle', { count: contextual?.count ?? profile?.activityStreak?.count ?? 0 }),
      subtitle: t('home.streakSubtitle'),
      tone: 'streak',
    };
  }

  return {
    title: t('home.objectiveTitle'),
    subtitle: t('home.objectiveProgress', {
      current: contextual?.current ?? profile?.objective?.current ?? 0,
      target: contextual?.target ?? profile?.objective?.target ?? 0,
    }),
    tone: 'objective',
  };
}

export function getVisibleStats(playerProfilePayload) {
  const profile = extractProfile(playerProfilePayload);
  const type = String(profile?.type ?? '').toLowerCase();
  if (type === 'chill') {
    return ['moments', 'badges', 'form', 'feed'];
  }
  if (type === 'competitor') {
    return ['form_recent', 'close_opponents', 'match_analysis', 'rivalries'];
  }
  return ['progression', 'rivalries', 'estimated_level', 'reference_matches'];
}

export function getMatchResultTone(playerProfilePayload, matchResult) {
  const profile = extractProfile(playerProfilePayload);
  const type = String(profile?.type ?? '').toLowerCase();
  if (type === 'chill') {
    return {
      titleKey: 'result.comeback',
      subtitleKey: 'result.tone.chill',
      subtitleParams: {
        name: matchResult?.partnerName ?? '',
      },
    };
  }
  if (type === 'competitor') {
    return {
      titleKey: 'result.keyMatch',
      subtitleKey: 'result.tone.competitor',
    };
  }
  return {
    titleKey: 'result.stressTag',
    subtitleKey: 'result.tone.regular',
  };
}
