import { requireUser } from '../services/authService.js';
import { HttpError } from './http.js';

export function extractBearer(req) {
  const raw = req.headers.authorization ?? '';
  if (!raw.startsWith('Bearer ')) {
    return null;
  }
  return raw.slice('Bearer '.length).trim();
}

export async function requireAuth(req) {
  const token = extractBearer(req);
  if (!token) {
    throw new HttpError(401, 'Missing auth token');
  }

  try {
    return await requireUser(token);
  } catch (error) {
    throw new HttpError(401, error.message || 'Invalid auth token', 'Authentication required');
  }
}

function adminEmailSet() {
  return new Set(
    String(process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireAdmin(req) {
  const me = await requireAuth(req);
  const allowedByFlag = me.isAdmin === true;
  const allowedByEmail = adminEmailSet().has(String(me.email ?? '').toLowerCase());
  if (!allowedByFlag && !allowedByEmail) {
    throw new HttpError(403, 'Admin access required');
  }
  return me;
}
