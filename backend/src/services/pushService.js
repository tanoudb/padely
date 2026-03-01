import { store } from '../store/index.js';

const MAX_TITLE_LENGTH = 64;
const MAX_BODY_LENGTH = 170;

let customSender = null;
let cachedExpoClientPromise = null;

function safeText(value, fallback, max) {
  const text = String(value ?? '').trim() || fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function isLikelyExpoPushToken(token) {
  return /^ExponentPushToken\[[\w-]+\]$/.test(String(token ?? '').trim())
    || /^ExpoPushToken\[[\w-]+\]$/.test(String(token ?? '').trim());
}

async function getExpoClient() {
  if (cachedExpoClientPromise) {
    return cachedExpoClientPromise;
  }

  cachedExpoClientPromise = (async () => {
    try {
      const mod = await import('expo-server-sdk');
      const Expo = mod.Expo ?? mod.default?.Expo;
      if (!Expo) {
        return null;
      }
      return new Expo({
        accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
        useFcmV1: true,
      });
    } catch {
      return null;
    }
  })();

  return cachedExpoClientPromise;
}

function sanitizePayload({ title, body, data }) {
  return {
    title: safeText(title, 'Padely', MAX_TITLE_LENGTH),
    body: safeText(body, 'Nouvelle activite sur Padely.', MAX_BODY_LENGTH),
    data: typeof data === 'object' && data ? data : {},
    sound: 'default',
    priority: 'high',
  };
}

function normalizePushTokenRecord(payload = {}) {
  const token = String(payload.token ?? '').trim();
  if (!token) {
    throw new Error('Push token required');
  }
  if (!isLikelyExpoPushToken(token)) {
    throw new Error('Invalid Expo push token');
  }

  return {
    token,
    platform: payload.platform ? String(payload.platform).trim().toLowerCase() : 'unknown',
    appVersion: payload.appVersion ? String(payload.appVersion).trim() : null,
    deviceName: payload.deviceName ? String(payload.deviceName).trim() : null,
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertUserPushToken(userId, payload) {
  const user = await store.getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const record = normalizePushTokenRecord(payload);
  const previous = Array.isArray(user.pushTokens) ? user.pushTokens : [];
  const withoutSameToken = previous.filter((item) => item?.token !== record.token);
  const pushTokens = [record, ...withoutSameToken].slice(0, 8);

  await store.updateUser(userId, { pushTokens });

  return {
    stored: true,
    token: record.token,
    count: pushTokens.length,
    updatedAt: record.updatedAt,
  };
}

async function buildMessagesForUsers(userIds, payload) {
  const uniqueUserIds = [...new Set((userIds ?? []).filter(Boolean))];
  if (!uniqueUserIds.length) {
    return [];
  }

  const users = await Promise.all(uniqueUserIds.map((id) => store.getUserById(id)));
  const messages = [];
  const content = sanitizePayload(payload);

  for (const user of users) {
    if (!user) continue;
    const pushTokens = Array.isArray(user.pushTokens) ? user.pushTokens : [];
    for (const item of pushTokens) {
      if (!isLikelyExpoPushToken(item?.token)) {
        continue;
      }
      messages.push({
        to: item.token,
        ...content,
      });
    }
  }

  return messages;
}

async function sendViaExpo(messages) {
  if (!messages.length) {
    return { sent: 0, receipts: 0, transport: 'none' };
  }

  if (typeof customSender === 'function') {
    const result = await customSender(messages);
    return {
      sent: messages.length,
      receipts: Number(result?.receipts ?? messages.length),
      transport: 'custom',
    };
  }

  const expo = await getExpoClient();
  if (expo) {
    let sent = 0;
    const tickets = [];
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      sent += chunk.length;
      tickets.push(...chunkTickets);
    }
    return {
      sent,
      receipts: tickets.length,
      transport: 'expo-server-sdk',
    };
  }

  let sent = 0;
  for (const message of messages) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    if (response.ok) {
      sent += 1;
    }
  }

  return {
    sent,
    receipts: sent,
    transport: 'expo-http-fallback',
  };
}

export async function sendPushToUsers(userIds, payload) {
  const messages = await buildMessagesForUsers(userIds, payload);
  if (!messages.length) {
    return {
      sent: 0,
      receipts: 0,
      transport: 'none',
    };
  }

  try {
    return await sendViaExpo(messages);
  } catch {
    return {
      sent: 0,
      receipts: 0,
      transport: 'failed',
    };
  }
}

export function setPushSenderForTests(sender) {
  customSender = typeof sender === 'function' ? sender : null;
}

export function resetPushServiceForTests() {
  customSender = null;
}
