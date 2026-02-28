import { store } from '../store/index.js';

export async function createListing(userId, payload) {
  if (!payload.title || !payload.priceEur) {
    throw new Error('title and priceEur are required');
  }

  return store.addMarketplaceListing({
    userId,
    title: payload.title,
    description: payload.description ?? '',
    category: payload.category ?? 'gear',
    condition: payload.condition ?? 'good',
    priceEur: Number(payload.priceEur),
    city: payload.city ?? 'Unknown',
  });
}

export async function listListings(filters) {
  return store.listMarketplace(filters);
}
