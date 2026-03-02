import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/api/rateLimit.js';
import {
  RequestValidationError,
  validateCreateMatchPayload,
  validateLoginPayload,
  validateMatchDecisionPayload,
  validateOnboardingPayload,
  validateRegisterPayload,
  validateUpdateProfilePayload,
} from '../src/api/validation.js';

test('register and login payloads are validated with field-level errors', () => {
  const register = validateRegisterPayload({
    email: 'alice@padely.app',
    password: 'padely2026',
    displayName: 'Alice',
  });
  assert.equal(register.email, 'alice@padely.app');

  const login = validateLoginPayload({
    email: 'alice@padely.app',
    password: 'padely2026',
  });
  assert.equal(login.email, 'alice@padely.app');

  assert.throws(
    () => validateRegisterPayload({ email: 'bad-email', password: '123' }),
    (error) => {
      assert.ok(error instanceof RequestValidationError);
      assert.equal(error.field, 'email');
      assert.ok(error.issues.some((issue) => issue.field === 'password'));
      return true;
    }
  );
});

test('match creation and validation payloads enforce required shape', () => {
  const payload = validateCreateMatchPayload({
    teamA: ['u1', 'u2'],
    teamB: ['u3', 'u4'],
    sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }],
    totalCostEur: 48,
  });
  assert.equal(payload.teamA.length, 2);

  const decision = validateMatchDecisionPayload({ accepted: true });
  assert.equal(decision.accepted, true);

  assert.throws(
    () => validateCreateMatchPayload({ teamA: ['u1'], teamB: ['u3', 'u4'], sets: [] }),
    (error) => {
      assert.ok(error instanceof RequestValidationError);
      assert.equal(error.field, 'teamA');
      return true;
    }
  );

  assert.throws(
    () => validateMatchDecisionPayload({ accepted: 'yes' }),
    (error) => {
      assert.ok(error instanceof RequestValidationError);
      assert.equal(error.field, 'accepted');
      return true;
    }
  );
});

test('profile update payload accepts valid metric ranges', () => {
  const profile = validateUpdateProfilePayload({
    displayName: 'Alice Pro',
    weightKg: 63,
    heightCm: 170,
    dominantHand: 'right',
    city: 'Lyon',
    location: { lat: 45.764, lng: 4.8357 },
  });

  assert.equal(profile.city, 'Lyon');

  assert.throws(
    () => validateUpdateProfilePayload({ weightKg: 2 }),
    (error) => {
      assert.ok(error instanceof RequestValidationError);
      assert.equal(error.field, 'weightKg');
      return true;
    }
  );
});

test('auth rate limiter allows 5 attempts then blocks the 6th in one minute window', () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 5,
    message: 'Too many attempts',
  });

  for (let i = 0; i < 5; i += 1) {
    const out = limiter.consume('ip-1', 1_000);
    assert.equal(out.remaining, 4 - i);
  }

  assert.throws(() => limiter.consume('ip-1', 1_000), /Too many attempts/);

  const nextWindow = limiter.consume('ip-1', 70_001);
  assert.equal(nextWindow.count, 1);
});

test('onboarding payload accepts city + preferences and rejects invalid values', () => {
  const onboarding = validateOnboardingPayload({
    level: 5,
    city: 'Paris',
    quizAnswers: {
      vitres: 'Souvent',
      filet: 'Maitrisee',
    },
    preferences: {
      defaultMatchMode: 'ranked',
      matchFormat: 'club',
      pointRule: 'punto_de_oro',
      autoSaveMatch: true,
      notifications: {
        matchInvites: true,
        partnerAvailability: false,
        leaderboardMovement: true,
      },
      publicProfile: true,
      showGuestMatches: false,
      showHealthStats: true,
    },
  });

  assert.equal(onboarding.city, 'Paris');
  assert.equal(onboarding.preferences.matchFormat, 'club');

  assert.throws(
    () => validateOnboardingPayload({ level: 11 }),
    (error) => {
      assert.ok(error instanceof RequestValidationError);
      assert.equal(error.field, 'level');
      return true;
    }
  );
});
