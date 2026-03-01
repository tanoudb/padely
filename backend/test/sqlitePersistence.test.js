import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SQLiteStore } from '../src/store/sqliteStore.js';

function tmpDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'padely-sqlite-'));
  return path.join(dir, 'padely.sqlite');
}

test('sqlite store persists users, matches, leaderboard, badges and messages across restart', async () => {
  const dbPath = tmpDbPath();

  const first = new SQLiteStore({ dbPath });
  const user = await first.createUser({
    email: 'persist@padely.app',
    passwordHash: 'hash',
    provider: 'email',
    displayName: 'Persist User',
    isVerified: true,
  });

  await first.updateUser(user.id, {
    city: 'Lyon',
    history: [{ delta: 8, at: new Date().toISOString(), didWin: true }],
  });

  const match = await first.createMatch({
    teamA: [user.id, 'usr_2'],
    teamB: ['usr_3', 'usr_4'],
    sets: [{ a: 6, b: 3 }],
    players: [user.id, 'usr_2', 'usr_3', 'usr_4'],
  });

  await first.createValidation({
    matchId: match.id,
    userId: 'usr_2',
    accepted: true,
  });

  await first.addPrivateMessage({
    id: 'dm_1',
    fromUserId: user.id,
    toUserId: 'usr_2',
    text: 'Salut',
    createdAt: new Date().toISOString(),
  });

  await first.addChannelMessage({
    id: 'msg_1',
    channel: 'france',
    text: 'Bonjour crew',
    senderName: 'Persist User',
    senderId: user.id,
    createdAt: new Date().toISOString(),
  });

  await first.unlockBadge(user.id, 'Serial Winner', { source: 'test' });
  await first.setLeaderboard('Lyon', [{ rank: 1, userId: user.id, rating: 1240 }]);

  const second = new SQLiteStore({ dbPath });

  const persistedUser = await second.getUserByEmail('persist@padely.app');
  assert.ok(persistedUser);
  assert.equal(persistedUser.city, 'Lyon');

  const persistedMatches = await second.listMatchesForUser(user.id);
  assert.equal(persistedMatches.length, 1);

  const persistedValidations = await second.listValidations(match.id);
  assert.equal(persistedValidations.length, 1);

  const dms = await second.listPrivateMessages(user.id, 'usr_2');
  assert.equal(dms.length, 1);
  assert.equal(dms[0].text, 'Salut');

  const channelMessages = await second.listChannelMessages('france');
  assert.equal(channelMessages.length, 1);

  const badges = await second.listBadgesForUser(user.id);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].badgeKey, 'Serial Winner');

  const leaderboard = await second.getLeaderboard('lyon');
  assert.equal(leaderboard.length, 1);
  assert.equal(leaderboard[0].userId, user.id);

  const clubs = await second.listClubs({ city: 'Lyon' });
  assert.ok(clubs.length >= 2);
});
