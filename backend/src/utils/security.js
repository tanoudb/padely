import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto
    .pbkdf2Sync(password, salt, 120000, 32, 'sha256')
    .toString('hex');
  return `${salt}:${digest}`;
}

export function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) {
    return false;
  }

  const candidate = crypto
    .pbkdf2Sync(password, salt, 120000, 32, 'sha256')
    .toString('hex');

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(candidate));
}

export function newToken() {
  return crypto.randomBytes(24).toString('hex');
}
