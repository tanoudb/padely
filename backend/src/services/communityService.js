import { store } from '../store/index.js';
import { findBalancedMatches } from '../engine/matchmaking.js';

function haversine(a, b) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const q = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(q));
}

export async function searchPlayers({ ratingMin = 0, ratingMax = 9999, lat, lng, radiusKm = 25 }) {
  const all = await store.listUsers();
  return all.filter((user) => {
    if (user.rating < ratingMin || user.rating > ratingMax) {
      return false;
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return true;
    }

    if (!user.location) {
      return false;
    }

    const d = haversine({ lat, lng }, user.location);
    return d <= radiusKm;
  }).map((user) => ({
    id: user.id,
    displayName: user.displayName,
    rating: user.rating,
    city: user.city,
    location: user.location,
  }));
}

export async function getBalancedProposals(players, maxResults) {
  return findBalancedMatches(players, { maxResults });
}

export async function refreshCityLeaderboard(city) {
  const users = (await store.listUsers())
    .filter((u) => (u.city ?? '').toLowerCase() === city.toLowerCase())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)
    .map((u, index) => ({
      rank: index + 1,
      userId: u.id,
      displayName: u.displayName,
      rating: u.rating,
      pir: u.pir,
    }));

  await store.setLeaderboard(city, users);
  return users;
}

export async function getCityLeaderboard(city) {
  const current = await store.getLeaderboard(city);
  if (current.length > 0) {
    return current;
  }

  return refreshCityLeaderboard(city);
}
