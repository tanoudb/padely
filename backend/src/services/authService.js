import crypto from 'node:crypto';
import { store } from '../store/index.js';
import { hashPassword, newToken, verifyPassword } from '../utils/security.js';

const SESSION_TTL_HOURS = Math.max(1, Number(process.env.SESSION_TTL_HOURS ?? 72));
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
const EMAIL_CODE_LENGTH = 6;
const EMAIL_CODE_TTL_MIN = Math.max(5, Number(process.env.EMAIL_CODE_TTL_MIN ?? 15));
const EMAIL_CODE_TTL_MS = EMAIL_CODE_TTL_MIN * 60 * 1000;
const IS_PROD = process.env.NODE_ENV === 'production';
const EXPOSE_DEV_EMAIL_CODE = process.env.EXPOSE_DEV_EMAIL_CODE === 'true';

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;
  return rest;
}

function parseJwtPayload(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) {
      return null;
    }
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function newEmailCode() {
  return String(crypto.randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, '0');
}

function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) {
    return '***';
  }
  const safeLocal = local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}

function oauthFallbackPayload(provider, idToken, email, displayName) {
  const payload = parseJwtPayload(idToken) ?? {};
  const safeEmail = email
    ?? payload.email
    ?? `${provider}_${String(idToken).slice(0, 10)}@padely.local`;

  return {
    email: safeEmail,
    displayName: displayName ?? payload.name ?? `${provider}-player`,
  };
}

async function verifyGoogleIdToken({ idToken }) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is missing');
  }

  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error('Google token missing email');
  }

  return {
    email: payload.email,
    displayName: payload.name ?? payload.given_name ?? 'google-player',
  };
}

async function verifyAppleIdToken({ idToken }) {
  const bundleId = process.env.APPLE_BUNDLE_ID;
  const serviceId = process.env.APPLE_SERVICE_ID;
  const audience = bundleId ?? serviceId;
  if (!audience) {
    throw new Error('APPLE_BUNDLE_ID or APPLE_SERVICE_ID is required');
  }

  const appleSigninAuth = await import('apple-signin-auth');
  const claims = await appleSigninAuth.verifyIdToken(idToken, {
    audience,
    ignoreExpiration: false,
  });
  if (!claims?.email && !claims?.sub) {
    throw new Error('Apple token missing subject');
  }

  return {
    email: claims.email ?? `apple_${claims.sub}@privaterelay.appleid.local`,
    displayName: claims.email ? claims.email.split('@')[0] : 'apple-player',
  };
}

async function verifyOAuthIdentity({ provider, idToken, email, displayName }) {
  const allowInsecureDev = process.env.ALLOW_INSECURE_OAUTH_DEV === 'true';
  try {
    if (provider === 'google') {
      return await verifyGoogleIdToken({ idToken });
    }
    return await verifyAppleIdToken({ idToken });
  } catch (error) {
    if (!allowInsecureDev) {
      throw new Error(`${provider} token verification failed: ${error.message}`);
    }
    return oauthFallbackPayload(provider, idToken, email, displayName);
  }
}

async function sendEmailVerificationCode({ email, code, token }) {
  const verifyBaseUrl = process.env.VERIFY_BASE_URL ?? 'http://127.0.0.1:8787/api/v1/auth/verify';
  const verificationUrl = `${verifyBaseUrl}?token=${encodeURIComponent(token)}`;
  const from = process.env.EMAIL_FROM ?? 'Padely <onboarding@resend.dev>';
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const resendKey = process.env.RESEND_API_KEY;

  const mailText = [
    `Ton code Padely: ${code}`,
    '',
    `Ce code expire dans ${EMAIL_CODE_TTL_MIN} minutes.`,
    `Lien alternatif: ${verificationUrl}`,
  ].join('\n');

  if (resendKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Padely - code de verification',
        text: mailText,
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend error: ${details.slice(0, 180)}`);
    }
    return {
      sent: true,
      provider: 'resend',
      verificationUrl,
    };
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      sent: false,
      provider: 'none',
      verificationUrl,
    };
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Padely - code de verification',
    text: mailText,
  });

  return {
    sent: true,
    provider: 'smtp',
    verificationUrl,
  };
}

async function issueEmailVerification(user) {
  const verificationToken = newToken();
  const verificationCode = newEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString();
  await store.deleteEmailVerificationTokensForUser(user.id);
  await store.createEmailVerificationToken(
    user.id,
    verificationToken,
    verificationCode,
    expiresAt
  );

  const mail = await sendEmailVerificationCode({
    email: user.email,
    code: verificationCode,
    token: verificationToken,
  });

  return {
    verificationToken,
    verificationCode,
    expiresAt,
    mail,
  };
}

export async function registerWithEmail({ email, password, displayName }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password || password.length < 8) {
    throw new Error('Invalid registration payload');
  }

  if (await store.getUserByEmail(normalizedEmail)) {
    throw new Error('Email already exists');
  }

  const user = await store.createUser({
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    provider: 'email',
    displayName: displayName ?? normalizedEmail.split('@')[0],
    isVerified: false,
  });

  const verification = await issueEmailVerification(user);

  return {
    requiresEmailVerification: true,
    verificationSent: verification.mail.sent,
    verificationProvider: verification.mail.provider,
    expiresInMinutes: EMAIL_CODE_TTL_MIN,
    codeLength: EMAIL_CODE_LENGTH,
    maskedEmail: maskEmail(user.email),
    devCode: !IS_PROD && EXPOSE_DEV_EMAIL_CODE ? verification.verificationCode : undefined,
    user: sanitizeUser(user),
  };
}

export async function loginWithEmail({ email, password }) {
  const user = await store.getUserByEmail(normalizeEmail(email));
  if (!user || !user.passwordHash || !verifyPassword(password ?? '', user.passwordHash)) {
    throw new Error('Invalid credentials');
  }
  if (!user.isVerified) {
    throw new Error('Email not verified');
  }

  const token = newToken();
  await store.createSession(user.id, token, SESSION_TTL_MS);
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

  const identity = await verifyOAuthIdentity({
    provider,
    idToken,
    email,
    displayName,
  });
  const safeEmail = identity.email;
  let user = await store.getUserByEmail(safeEmail);

  if (!user) {
    user = await store.createUser({
      email: safeEmail,
      provider,
      displayName: identity.displayName ?? `${provider}-player`,
      passwordHash: null,
      isVerified: true,
    });
  }

  const token = newToken();
  await store.createSession(user.id, token, SESSION_TTL_MS);
  return { token, user: sanitizeUser(user) };
}

export async function resendEmailVerificationCode({ email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required');
  }

  const user = await store.getUserByEmail(normalizedEmail);
  if (!user) {
    return {
      ok: true,
      requiresEmailVerification: true,
      verificationSent: false,
      expiresInMinutes: EMAIL_CODE_TTL_MIN,
      codeLength: EMAIL_CODE_LENGTH,
      maskedEmail: maskEmail(normalizedEmail),
    };
  }

  if (user.isVerified) {
    return {
      ok: true,
      alreadyVerified: true,
      maskedEmail: maskEmail(normalizedEmail),
    };
  }

  const verification = await issueEmailVerification(user);
  return {
    ok: true,
    requiresEmailVerification: true,
    verificationSent: verification.mail.sent,
    verificationProvider: verification.mail.provider,
    expiresInMinutes: EMAIL_CODE_TTL_MIN,
    codeLength: EMAIL_CODE_LENGTH,
    maskedEmail: maskEmail(user.email),
    devCode: !IS_PROD && EXPOSE_DEV_EMAIL_CODE ? verification.verificationCode : undefined,
  };
}

export async function verifyEmailCode({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanCode = String(code ?? '').trim();
  if (!normalizedEmail || cleanCode.length !== EMAIL_CODE_LENGTH) {
    throw new Error('Invalid verification code');
  }

  const user = await store.getUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error('Invalid verification code');
  }
  if (user.isVerified) {
    const sessionToken = newToken();
    await store.createSession(user.id, sessionToken, SESSION_TTL_MS);
    return {
      token: sessionToken,
      user: sanitizeUser(user),
      verified: true,
    };
  }

  const item = await store.consumeEmailVerificationCode(user.id, cleanCode);
  if (!item) {
    throw new Error('Invalid verification code');
  }
  if (new Date(item.expiresAt).getTime() < Date.now()) {
    throw new Error('Verification code expired');
  }

  const updated = await store.updateUser(user.id, {
    isVerified: true,
  });
  const sessionToken = newToken();
  await store.createSession(updated.id, sessionToken, SESSION_TTL_MS);

  return {
    token: sessionToken,
    user: sanitizeUser(updated),
    verified: true,
  };
}

export async function verifyEmailToken(token) {
  if (!token || token.length < 10) {
    throw new Error('Invalid verification token');
  }

  const item = await store.consumeEmailVerificationToken(token);
  if (!item) {
    throw new Error('Verification token not found');
  }
  if (new Date(item.expiresAt).getTime() < Date.now()) {
    throw new Error('Verification token expired');
  }

  const user = await store.getUserById(item.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const updated = await store.updateUser(user.id, {
    isVerified: true,
  });
  const sessionToken = newToken();
  await store.createSession(updated.id, sessionToken, SESSION_TTL_MS);

  return {
    token: sessionToken,
    user: sanitizeUser(updated),
    verified: true,
  };
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
