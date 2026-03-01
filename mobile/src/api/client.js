const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8787';

async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'API error');
  }

  return payload;
}

export const api = {
  register: (body) => request('/api/v1/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/v1/auth/login', { method: 'POST', body }),
  oauthGoogle: (body) => request('/api/v1/auth/oauth/google', { method: 'POST', body }),
  oauthApple: (body) => request('/api/v1/auth/oauth/apple', { method: 'POST', body }),
  verifyEmail: (token) => request('/api/v1/auth/verify', { method: 'POST', body: { token } }),
  profile: (token) => request('/api/v1/profile', { token }),
  completeOnboarding: (token, body) => request('/api/v1/profile/onboarding', { method: 'PUT', token, body }),
  updateAthlete: (token, body) => request('/api/v1/profile/athlete', { method: 'PUT', token, body }),
  updateSettings: (token, body) => request('/api/v1/profile/settings', { method: 'PUT', token, body }),
  createMatch: (token, body) => request('/api/v1/matches', { method: 'POST', token, body }),
  listMyMatches: (token, status) => request(`/api/v1/matches${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),
  validateMatch: (token, matchId, accepted) => request(`/api/v1/matches/${matchId}/validate`, { method: 'POST', token, body: { accepted } }),
  createMatchInvite: (token, matchId) => request(`/api/v1/matches/${matchId}/invite`, { method: 'POST', token }),
  listPlayers: (token) => request('/api/v1/community/players?ratingMin=900&ratingMax=2400', { token }),
  leaderboard: (token, city) => request(`/api/v1/community/leaderboard?city=${encodeURIComponent(city)}`, { token }),
  crew: (token, city) => request(`/api/v1/community/crew${city ? `?city=${encodeURIComponent(city)}` : ''}`, { token }),
  addFriend: (token, friendId) => request('/api/v1/community/friends', { method: 'POST', token, body: { friendId } }),
  channelMessages: (token, channel) => request(`/api/v1/community/channels/${encodeURIComponent(channel)}/messages`, { token }),
  sendChannelMessage: (token, channel, text) => request(`/api/v1/community/channels/${encodeURIComponent(channel)}/messages`, { method: 'POST', token, body: { text } }),
  privateMessages: (token, friendId) => request(`/api/v1/community/messages/${encodeURIComponent(friendId)}`, { token }),
  sendPrivateMessage: (token, friendId, text) => request(`/api/v1/community/messages/${encodeURIComponent(friendId)}`, { method: 'POST', token, body: { text } }),
  dashboard: (token, userId) => request(`/api/v1/stats/dashboard/${userId}`, { token }),
  duoStats: (token, userId) => request(`/api/v1/stats/duo/${userId}`, { token }),
  holes: (token, userId) => request(`/api/v1/stats/performance-holes/${userId}`, { token }),
  listings: (token, city) => request(`/api/v1/marketplace/listings?city=${encodeURIComponent(city)}`, { token }),
  createListing: (token, body) => request('/api/v1/marketplace/listings', { method: 'POST', token, body }),
};
