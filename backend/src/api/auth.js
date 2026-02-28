import { requireUser } from '../services/authService.js';

export function extractBearer(req) {
  const raw = req.headers.authorization ?? '';
  if (!raw.startsWith('Bearer ')) {
    return null;
  }
  return raw.slice('Bearer '.length).trim();
}

export async function requireAuth(req) {
  const token = extractBearer(req);
  return requireUser(token);
}
