import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWithEmail } from '../src/services/authService.js';
import {
  addMembersToGroup,
  createGroup,
  joinGroup,
  joinGroupByCode,
  leaveGroup,
  listGroupMessages,
  listMyGroups,
  postGroupMessage,
} from '../src/services/groupService.js';

async function createUsers(prefix, total) {
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const user = (await registerWithEmail({
      email: `${prefix}_${i}@padely.app`,
      password: `strongpass_${i}_2026`,
      displayName: `${prefix} ${i}`,
    })).user;
    out.push(user);
  }
  return out;
}

test('private group lifecycle: create, add members, message, leave', async () => {
  const [owner, u1, u2, u3] = await createUsers('group_private', 4);

  const created = await createGroup({
    userId: owner.id,
    name: 'Team Tuesday',
    members: [u1.id, u2.id],
    type: 'private',
  });

  assert.equal(created.type, 'private');
  assert.equal(created.name, 'Team Tuesday');
  assert.ok(created.members.includes(owner.id));
  assert.ok(created.members.includes(u1.id));

  const updated = await addMembersToGroup({
    userId: owner.id,
    groupId: created.id,
    members: [u3.id],
  });
  assert.ok(updated.members.includes(u3.id));

  await postGroupMessage({
    userId: owner.id,
    groupId: created.id,
    text: 'Session demain 19h',
  });

  const page = await listGroupMessages({
    userId: u1.id,
    groupId: created.id,
    limit: 20,
  });
  assert.ok(Array.isArray(page.items));
  assert.ok(page.items.some((item) => item.text.includes('Session')));

  await leaveGroup({ userId: u3.id, groupId: created.id });
  const groupsU3 = await listMyGroups(u3.id);
  assert.equal(groupsU3.groups.some((row) => row.id === created.id), false);
});

test('club groups join with code', async () => {
  const [user] = await createUsers('group_club', 1);
  const groupId = 'grp_club_urban_padel_lyon';

  const joined = await joinGroup({
    userId: user.id,
    groupId,
    clubCode: 'UP-LYON-01',
  });

  assert.equal(joined.joined, true);
  assert.equal(joined.group.type, 'club');
  assert.ok(joined.group.members.includes(user.id));

  const mine = await listMyGroups(user.id);
  assert.ok(mine.groups.some((group) => group.id === groupId));
});

test('join club with code without providing group id', async () => {
  const [user] = await createUsers('group_club_code', 1);
  const joined = await joinGroupByCode({
    userId: user.id,
    clubCode: 'EP-VILLEUR-02',
  });

  assert.equal(joined.joined, true);
  assert.equal(joined.group.type, 'club');
  assert.equal(joined.group.id, 'grp_club_esprit_padel_villeurbanne');
});
