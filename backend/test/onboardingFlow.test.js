import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import { completeOnboarding } from '../src/services/profileService.js';

test('complete onboarding persists city and gameplay preferences', async () => {
  const user = (await registerWithEmail({
    email: 'onboard@padely.app',
    password: 'strongpass1',
    displayName: 'Onboarded',
  })).user;

  const profile = await completeOnboarding(user.id, {
    level: 6,
    city: 'Marseille',
    quizAnswers: {
      vitres: 'Souvent',
      filet: 'Maitrisee',
      tournoi: 'Frequent',
      technique: 'Avancee',
    },
    preferences: {
      defaultMatchMode: 'friendly',
      matchFormat: 'club',
      pointRule: 'avantage',
      autoSaveMatch: false,
      notifications: {
        matchInvites: true,
        partnerAvailability: false,
        leaderboardMovement: true,
      },
      publicProfile: false,
      showGuestMatches: true,
      showHealthStats: false,
    },
  });

  assert.equal(profile.onboarding.completed, true);
  assert.equal(profile.city, 'Marseille');
  assert.equal(profile.athlete.level, 6);
  assert.equal(profile.settings.defaultMatchMode, 'friendly');
  assert.equal(profile.settings.matchFormat, 'club');
  assert.equal(profile.settings.pointRule, 'avantage');
  assert.equal(profile.settings.autoSaveMatch, false);
  assert.equal(profile.settings.notificationPreferences.partnerAvailability, false);
  assert.equal(profile.privacy.publicProfile, false);
  assert.equal(profile.privacy.showGuestMatches, true);
  assert.equal(profile.privacy.showHealthStats, false);
});
