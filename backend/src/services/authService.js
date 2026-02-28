import { store } from '../store/index.js';
import { hashPassword, newToken, verifyPassword } from '../utils/security.js';

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return rest;
}

export async function registerWithEmail({ email, password, displayName }) {
  if (!email || !password || password.length < 8) {
    throw new Error('Invalid registration payload');
  }

  if (await store.getUserByEmail(email)) {
    throw new Error('Email already exists');
  }

  const user = await store.createUser({
    email,
    passwordHash: hashPassword(password),
    provider: 'email',
    displayName: displayName ?? email.split('@')[0],
  });

  const token = newToken();
  await store.createSession(user.id, token);
  return { token, user: sanitizeUser(user) };
}

export async function loginWithEmail({ email, password }) {
  const user = await store.getUserByEmail(email ?? '');
  if (!user || !user.passwordHash || !verifyPassword(password ?? '', user.passwordHash)) {
    throw new Error('Invalid credentials');
  }

  const token = newToken();
  await store.createSession(user.id, token);
  return { token, user: sanitizeUser(user) };
}

// OAuth verification is intentionally lightweight in MVP mode.
export async function loginWithProvider({ provider, idToken, email, displayName }) {
  if (!['google', 'apple'].includes(provider)) {
    throw new Error('Unsupported provider');
  }

  if (!idToken || idToken.length < 10) {
    throw new Error('Invalid OAuth token');
  }

  const safeEmail = email ?? `${provider}_${idToken.slice(0, 8)}@padely.local`;
  let user = await store.getUserByEmail(safeEmail);

  if (!user) {
    user = await store.createUser({
      email: safeEmail,
      provider,
      displayName: displayName ?? `${provider}-player`,
      passwordHash: null,
    });
  }

  const token = newToken();
  await store.createSession(user.id, token);
  return { token, user: sanitizeUser(user) };
}

export async function requireUser(token) {
  if (!token) {
    throw new Error('Missing auth token');
  }

  const session = await store.getSession(token);
  if (!session) {
    throw new Error('Invalid auth token');
  }

  const user = await store.getUserById(session.userId);
  if (!user) {
    throw new Error('User not found');
  }

  return sanitizeUser(user);
}
