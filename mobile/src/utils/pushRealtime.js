import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId
    || null
  );
}

export async function registerForRealtimePush() {
  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;

  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }

  if (status !== 'granted') {
    return {
      granted: false,
      token: null,
      reason: 'permission_denied',
    };
  }

  const projectId = getProjectId();
  const expoPushToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4A853',
    });
  }

  return {
    granted: true,
    token: expoPushToken?.data ?? null,
    projectId,
  };
}

export function resolvePushRoute(data = {}) {
  const type = String(data.type ?? '').toLowerCase();
  const matchId = data.matchId ? String(data.matchId) : null;
  const friendId = data.fromUserId ? String(data.fromUserId) : null;
  const profileUserId = data.profileUserId ? String(data.profileUserId) : null;

  if (
    type === 'match_created'
    || type === 'match_validated'
    || type === 'match_rejected'
    || type === 'player_invited'
    || type === 'matchmaking_invite'
  ) {
    return {
      tab: friendId ? 'CommunityTab' : 'PlayTab',
      params: friendId
        ? {
            screen: 'CommunityMain',
            params: {
              friendId,
              matchId,
            },
          }
        : {
            screen: 'PlaySetup',
            params: {
              matchId,
            },
          },
    };
  }

  if (profileUserId) {
    return {
      tab: 'ProfileTab',
      params: {
        screen: 'ProfileMain',
        params: {
          profileUserId,
        },
      },
    };
  }

  return {
    tab: 'CommunityTab',
    params: {
      screen: 'CommunityMain',
      params: {
        city: data.city ? String(data.city) : undefined,
      },
    },
  };
}

export function getPushDataFromNotification(notification) {
  return notification?.request?.content?.data ?? {};
}
