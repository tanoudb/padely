export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8787';

export class ApiError extends Error {
  constructor(message, { status, code, field, issues } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code ?? 'api_error';
    this.field = field ?? null;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Connexion API impossible (${API_URL}). Lance le backend puis reessaie.`, {
      code: 'network_error',
    });
  }

  const raw = await response.text();
  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {
        error: raw.slice(0, 180),
      };
    }
  }

  if (!response.ok) {
    throw new ApiError(payload.message || payload.error || `HTTP ${response.status}`, {
      status: response.status,
      code: payload.error || 'api_error',
      field: payload.field ?? null,
      issues: payload.issues ?? [],
    });
  }

  return payload;
}

function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  register: (body) => request('/api/v1/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/v1/auth/login', { method: 'POST', body }),
  oauthGoogle: (body) => request('/api/v1/auth/oauth/google', { method: 'POST', body }),
  oauthApple: (body) => request('/api/v1/auth/oauth/apple', { method: 'POST', body }),
  verifyEmail: (body) => request('/api/v1/auth/verify', { method: 'POST', body }),
  resendVerificationCode: (email) => request('/api/v1/auth/verify/resend', { method: 'POST', body: { email } }),
  profile: (token) => request('/api/v1/profile', { token }),
  completeOnboarding: (token, body) => request('/api/v1/profile/onboarding', { method: 'PUT', token, body }),
  updateAthlete: (token, body) => request('/api/v1/profile/athlete', { method: 'PUT', token, body }),
  updateSettings: (token, body) => request('/api/v1/profile/settings', { method: 'PUT', token, body }),
  updatePushToken: (token, body) => request('/api/v1/profile/push-token', { method: 'PUT', token, body }),
  createMatch: (token, body) => request('/api/v1/matches', { method: 'POST', token, body }),
  startLiveMatch: (token, body) => request('/api/v1/matches/live', { method: 'POST', token, body }),
  updateLiveScore: (token, matchId, body) => request(`/api/v1/matches/${encodeURIComponent(matchId)}/live`, {
    method: 'PUT',
    token,
    body,
  }),
  closeLiveMatch: (token, matchId, body = {}) => request(`/api/v1/matches/${encodeURIComponent(matchId)}/live`, {
    method: 'DELETE',
    token,
    body,
  }),
  liveMatchState: (token, matchId) => request(`/api/v1/matches/${encodeURIComponent(matchId)}/live/state`, { token }),
  listMyMatches: (token, status) => request(`/api/v1/matches${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),
  validateMatch: (token, matchId, accepted) => request(`/api/v1/matches/${matchId}/validate`, { method: 'POST', token, body: { accepted } }),
  createMatchInvite: (token, matchId) => request(`/api/v1/matches/${matchId}/invite`, { method: 'POST', token }),
  listPlayers: (token) => request('/api/v1/community/players?ratingMin=900&ratingMax=2400', { token }),
  matchmakingSuggestions: (token, options = {}) =>
    request(`/api/v1/community/matchmaking/suggestions${toQuery(options)}`, { token }),
  proposeMatchmaking: (token, body) =>
    request('/api/v1/community/matchmaking/propose', { method: 'POST', token, body }),
  leaderboard: (token, city) => request(`/api/v1/community/leaderboard?city=${encodeURIComponent(city)}`, { token }),
  leaderboardByPeriod: (token, city, period) => request(`/api/v1/community/leaderboard?city=${encodeURIComponent(city)}&period=${encodeURIComponent(period)}`, { token }),
  leaderboardPeriods: (token, city) => request(`/api/v1/community/leaderboard/periods?city=${encodeURIComponent(city)}`, { token }),
  crew: (token, city) => request(`/api/v1/community/crew${city ? `?city=${encodeURIComponent(city)}` : ''}`, { token }),
  communityUnread: (token) => request('/api/v1/community/unread', { token }),
  addFriend: (token, friendId) => request('/api/v1/community/friends', { method: 'POST', token, body: { friendId } }),
  arcadeSearch: (token, tag) => request(`/api/v1/community/arcade/search?tag=${encodeURIComponent(tag)}`, { token }),
  arcadeConnect: (token, tag) => request('/api/v1/community/arcade/connect', { method: 'POST', token, body: { tag } }),
  createChannel: (token, name) => request('/api/v1/community/channels', { method: 'POST', token, body: { name } }),
  joinClubByCode: (token, code) => request('/api/v1/community/clubs/join', { method: 'POST', token, body: { code } }),
  channelMessages: async (token, channel, options = {}) => {
    const out = await request(`/api/v1/community/channels/${encodeURIComponent(channel)}/messages${toQuery(options)}`, { token });
    return out.items ?? [];
  },
  channelMessagesPage: (token, channel, options = {}) =>
    request(`/api/v1/community/channels/${encodeURIComponent(channel)}/messages${toQuery(options)}`, { token }),
  markChannelRead: (token, channel, readAt) =>
    request(`/api/v1/community/channels/${encodeURIComponent(channel)}/read`, { method: 'POST', token, body: { readAt } }),
  sendChannelMessage: (token, channel, text) => request(`/api/v1/community/channels/${encodeURIComponent(channel)}/messages`, { method: 'POST', token, body: { text } }),
  privateMessages: async (token, friendId, options = {}) => {
    const out = await request(`/api/v1/community/messages/${encodeURIComponent(friendId)}${toQuery(options)}`, { token });
    return out.items ?? [];
  },
  privateMessagesPage: (token, friendId, options = {}) =>
    request(`/api/v1/community/messages/${encodeURIComponent(friendId)}${toQuery(options)}`, { token }),
  markPrivateRead: (token, friendId, readAt) =>
    request(`/api/v1/community/messages/${encodeURIComponent(friendId)}/read`, { method: 'POST', token, body: { readAt } }),
  sendPrivateMessage: (token, friendId, text) => request(`/api/v1/community/messages/${encodeURIComponent(friendId)}`, { method: 'POST', token, body: { text } }),
  dashboard: (token, userId, period = 'all') =>
    request(`/api/v1/stats/dashboard/${encodeURIComponent(userId)}${toQuery({ period })}`, { token }),
  duoStats: (token, userId, period = 'all') =>
    request(`/api/v1/stats/duo/${encodeURIComponent(userId)}${toQuery({ period })}`, { token }),
  headToHead: (token, userId, opponentId, period = 'all') =>
    request(`/api/v1/stats/head-to-head/${encodeURIComponent(userId)}/${encodeURIComponent(opponentId)}${toQuery({ period })}`, { token }),
  records: (token, userId, period = 'all') =>
    request(`/api/v1/stats/records/${encodeURIComponent(userId)}${toQuery({ period })}`, { token }),
  publicProfile: (token, playerId, period = 'all') =>
    request(`/api/v1/stats/public-profile/${encodeURIComponent(playerId)}${toQuery({ period })}`, { token }),
  holes: (token, userId, period = 'all') =>
    request(`/api/v1/stats/performance-holes/${encodeURIComponent(userId)}${toQuery({ period })}`, { token }),
  seasons: (token, city) =>
    request(`/api/v1/gamification/seasons${toQuery({ city })}`, { token }),
  badges: (token, userId) =>
    request(`/api/v1/gamification/badges/${encodeURIComponent(userId)}`, { token }),
  listings: (token, city) => request(`/api/v1/marketplace/listings?city=${encodeURIComponent(city)}`, { token }),
  createListing: (token, body) => request('/api/v1/marketplace/listings', { method: 'POST', token, body }),
};
