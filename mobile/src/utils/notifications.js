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

async function scheduleDaily({ hour, minute, title, body, data }) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
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
  const txt = dictionaries[language]?.notifications ?? dictionaries.fr.notifications;

  if (settings.notifPartnerAvailable) {
    ids.push(await scheduleDaily({
      hour: 18,
      minute: 30,
      title: txt.partnerTitle,
      body: txt.partnerBody,
      data: { type: 'partner-availability' },
    }));
  }

  if (settings.notifMatchInvite) {
    ids.push(await scheduleDaily({
      hour: 12,
      minute: 15,
      title: txt.inviteTitle,
      body: txt.inviteBody,
      data: { type: 'match-invite' },
    }));
  }

  if (settings.notifLeaderboard) {
    ids.push(await scheduleDaily({
      hour: 20,
      minute: 0,
      title: txt.leaderboardTitle,
      body: txt.leaderboardBody,
      data: { type: 'leaderboard' },
    }));
  }

  return {
    enabled: true,
    scheduled: ids.length,
  };
}
