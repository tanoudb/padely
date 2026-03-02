import { json, readJson } from '../http.js';
import {
  validateLoginPayload,
  validateOnboardingPayload,
  validateRegisterPayload,
  validateUpdateProfilePayload,
} from '../validation.js';
import { requireAuth } from '../auth.js';
import {
  loginWithEmail,
  loginWithProvider,
  registerWithEmail,
  resendEmailVerificationCode,
  verifyEmailCode,
  verifyEmailToken,
} from '../../services/authService.js';
import {
  completeOnboarding,
  getProfile,
  updatePinnedBadges,
  updatePushToken,
  updateAthleteProfile,
  updateUserSettings,
} from '../../services/profileService.js';
import { getPlayerProfile } from '../../services/playerProfileService.js';
import { exact } from './routeBuilder.js';

export const authProfileRoutes = [
  exact('POST', '/api/v1/auth/register', async ({ req, res }) => {
    const payload = validateRegisterPayload(await readJson(req));
    return json(res, 201, await registerWithEmail(payload));
  }),
  exact('POST', '/api/v1/auth/login', async ({ req, res }) => {
    const payload = validateLoginPayload(await readJson(req));
    return json(res, 200, await loginWithEmail(payload));
  }),
  exact('POST', '/api/v1/auth/oauth/google', async ({ req, res }) => {
    const payload = await readJson(req);
    return json(res, 200, await loginWithProvider({ ...payload, provider: 'google' }));
  }),
  exact('POST', '/api/v1/auth/oauth/apple', async ({ req, res }) => {
    const payload = await readJson(req);
    return json(res, 200, await loginWithProvider({ ...payload, provider: 'apple' }));
  }),
  exact('GET', '/api/v1/auth/verify', async ({ res, url }) => {
    const token = url.searchParams.get('token');
    return json(res, 200, await verifyEmailToken(token));
  }),
  exact('POST', '/api/v1/auth/verify', async ({ req, res }) => {
    const payload = await readJson(req);
    if (payload.token) {
      return json(res, 200, await verifyEmailToken(payload.token));
    }
    return json(res, 200, await verifyEmailCode({
      email: payload.email,
      code: payload.code,
    }));
  }),
  exact('POST', '/api/v1/auth/verify/resend', async ({ req, res }) => {
    const payload = await readJson(req);
    return json(res, 200, await resendEmailVerificationCode({
      email: payload.email,
    }));
  }),
  exact('GET', '/api/v1/me', async ({ req, res }) => {
    const me = await requireAuth(req);
    return json(res, 200, me);
  }),
  exact('PUT', '/api/v1/profile/athlete', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = validateUpdateProfilePayload(await readJson(req));
    return json(res, 200, await updateAthleteProfile(me.id, payload));
  }),
  exact('GET', '/api/v1/profile', async ({ req, res }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getProfile(me.id));
  }),
  exact('GET', '/api/v1/profile/player-profile', async ({ req, res }) => {
    const me = await requireAuth(req);
    return json(res, 200, await getPlayerProfile(me.id));
  }),
  exact('PUT', '/api/v1/profile/onboarding', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = validateOnboardingPayload(await readJson(req));
    return json(res, 200, await completeOnboarding(me.id, payload));
  }),
  exact('PUT', '/api/v1/profile/settings', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await updateUserSettings(me.id, payload));
  }),
  exact('PUT', '/api/v1/profile/pinned-badges', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await updatePinnedBadges(me.id, payload));
  }),
  exact('PUT', '/api/v1/profile/push-token', async ({ req, res }) => {
    const me = await requireAuth(req);
    const payload = await readJson(req);
    return json(res, 200, await updatePushToken(me.id, payload));
  }),
];
