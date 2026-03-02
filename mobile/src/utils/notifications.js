import * as Notifications from 'expo-notifications';
import { dictionaries } from '../i18n/dictionaries';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const RHYTHM_CAP = {
  light: 1,
  regular: 2,
  intense: 3,
};

const RHYTHM_SLOTS = {
  light: [
    { weekday: 5, hour: 18, minute: 30 },
  ],
  regular: [
    { weekday: 3, hour: 18, minute: 30 },
    { weekday: 6, hour: 12, minute: 15 },
  ],
  intense: [
    { weekday: 2, hour: 18, minute: 30 },
    { weekday: 4, hour: 12, minute: 15 },
    { weekday: 6, hour: 20, minute: 0 },
  ],
};

function normalizeRhythm(raw) {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'light' || value === 'regular' || value === 'intense') {
    return value;
  }
  return 'regular';
}

async function scheduleWeekly({ weekday, hour, minute, title, body, data }) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      weekday,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function configureEngagementNotifications(settings = {}) {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return {
      enabled: false,
      scheduled: 0,
    };
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  const ids = [];
  const language = settings.language === 'en' ? 'en' : 'fr';
  const rhythm = normalizeRhythm(settings.playerRhythm);
  const txt = dictionaries[language]?.notifications ?? dictionaries.fr.notifications;
  const slots = RHYTHM_SLOTS[rhythm];
  const cap = RHYTHM_CAP[rhythm];
  const candidates = [];

  if (settings.notifPartnerAvailable) {
    candidates.push({
      title: txt.partnerTitle,
      body: rhythm === 'light' ? txt.partnerBodyLight : txt.partnerBody,
      data: { type: 'partner-availability' },
    });
  }

  if (settings.notifMatchInvite) {
    candidates.push({
      title: txt.inviteTitle,
      body: rhythm === 'light' ? txt.inviteBodyLight : txt.inviteBody,
      data: { type: 'match-invite' },
    });
  }

  if (settings.notifLeaderboard) {
    candidates.push({
      title: txt.leaderboardTitle,
      body: rhythm === 'light' ? txt.leaderboardBodyLight : txt.leaderboardBody,
      data: { type: 'leaderboard' },
    });
  }

  const contextual = settings.contextual ?? {};
  if (contextual.preferredDayLabel) {
    candidates.push({
      title: txt.contextDayTitle,
      body: txt.contextDayBody.replace('{day}', String(contextual.preferredDayLabel)),
      data: { type: 'context_day' },
    });
  }
  if (contextual.nearBestStreak) {
    candidates.push({
      title: txt.contextStreakTitle,
      body: txt.contextStreakBody,
      data: { type: 'context_streak' },
    });
  }
  if (Number(contextual.pausePatternDays) > 0) {
    candidates.push({
      title: txt.contextRestTitle,
      body: txt.contextRestBody.replace('{days}', String(contextual.pausePatternDays)),
      data: { type: 'context_pause_pattern' },
    });
  }

  const scheduledCandidates = candidates.slice(0, Math.min(cap, slots.length));
  for (let index = 0; index < scheduledCandidates.length; index += 1) {
    const slot = slots[index];
    const item = scheduledCandidates[index];
    ids.push(await scheduleWeekly({
      weekday: slot.weekday,
      hour: slot.hour,
      minute: slot.minute,
      title: item.title,
      body: item.body,
      data: item.data,
    }));
  }

  return {
    enabled: true,
    scheduled: ids.length,
  };
}
