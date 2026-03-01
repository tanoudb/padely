import { store } from './index.js';
import { hashPassword } from '../utils/security.js';

export async function seedDemoData() {
  if ((await store.listUsers()).length > 0) {
    return;
  }

  const players = [
    {
      email: 'alice@padely.app',
      displayName: 'Alice',
      rating: 1340,
      city: 'Lyon',
      location: { lat: 45.764, lng: 4.8357 },
    },
    {
      email: 'ben@padely.app',
      displayName: 'Ben',
      rating: 1290,
      city: 'Lyon',
      location: { lat: 45.76, lng: 4.84 },
    },
    {
      email: 'chloe@padely.app',
      displayName: 'Chloe',
      rating: 1260,
      city: 'Lyon',
      location: { lat: 45.758, lng: 4.842 },
    },
    {
      email: 'dylan@padely.app',
      displayName: 'Dylan',
      rating: 1220,
      city: 'Lyon',
      location: { lat: 45.767, lng: 4.83 },
    },
  ];

  for (const player of players) {
    const user = await store.createUser({
      email: player.email,
      displayName: player.displayName,
      passwordHash: hashPassword('padely2026'),
      provider: 'email',
    });

    await store.updateUser(user.id, {
      rating: player.rating,
      city: player.city,
      location: player.location,
      pir: 55,
      isVerified: true,
      athlete: {
        ...user.athlete,
        level: 4,
      },
      settings: {
        pointRule: 'punto_de_oro',
        matchFormat: 'standard',
        autoSideSwitch: true,
      },
      onboarding: {
        completed: true,
        quizAnswers: null,
      },
      calibration: {
        matchesPlayed: 10,
        remainingMatches: 0,
      },
    });
  }
}
