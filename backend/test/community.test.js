import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { refreshCityLeaderboard, searchPlayers } from '../src/services/communityService.js';
import { createListing, listListings } from '../src/services/marketplaceService.js';
import { updateAthleteProfile } from '../src/services/profileService.js';

test('community search and local marketplace listing', async () => {
  const u = (await registerWithEmail({ email: 'city1@padely.app', password: 'strongpass1', displayName: 'CityOne' })).user;
  await updateAthleteProfile(u.id, {
    city: 'Paris',
    location: { lat: 48.8566, lng: 2.3522 },
    weightKg: 73,
    heightCm: 178,
  });

  const found = await searchPlayers({
    ratingMin: 900,
    ratingMax: 1800,
    lat: 48.8566,
    lng: 2.3522,
    radiusKm: 30,
  });

  assert.ok(found.some((p) => p.id === u.id));

  const listing = await createListing(u.id, {
    title: 'Raquette Bullpadel Vertex',
    priceEur: 120,
    city: 'Paris',
    category: 'racket',
  });

  assert.equal(listing.status, 'active');

  const listings = await listListings({ city: 'Paris' });
  assert.ok(listings.some((item) => item.id === listing.id));

  const leaderboard = await refreshCityLeaderboard('Paris');
  assert.ok(Array.isArray(leaderboard));
});
