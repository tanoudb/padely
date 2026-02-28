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
  profile: (token) => request('/api/v1/profile', { token }),
  completeOnboarding: (token, body) => request('/api/v1/profile/onboarding', { method: 'PUT', token, body }),
  updateAthlete: (token, body) => request('/api/v1/profile/athlete', { method: 'PUT', token, body }),
  createMatch: (token, body) => request('/api/v1/matches', { method: 'POST', token, body }),
  listMyMatches: (token, status) => request(`/api/v1/matches${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),
  validateMatch: (token, matchId, accepted) => request(`/api/v1/matches/${matchId}/validate`, { method: 'POST', token, body: { accepted } }),
  listPlayers: (token) => request('/api/v1/community/players?ratingMin=900&ratingMax=1800', { token }),
  leaderboard: (token, city) => request(`/api/v1/community/leaderboard?city=${encodeURIComponent(city)}`, { token }),
  dashboard: (token, userId) => request(`/api/v1/stats/dashboard/${userId}`, { token }),
  duoStats: (token, userId) => request(`/api/v1/stats/duo/${userId}`, { token }),
  holes: (token, userId) => request(`/api/v1/stats/performance-holes/${userId}`, { token }),
  bag: (token) => request('/api/v1/bag/items', { token }),
  addBagItem: (token, body) => request('/api/v1/bag/items', { method: 'POST', token, body }),
  listings: (token, city) => request(`/api/v1/marketplace/listings?city=${encodeURIComponent(city)}`, { token }),
  createListing: (token, body) => request('/api/v1/marketplace/listings', { method: 'POST', token, body }),
};
