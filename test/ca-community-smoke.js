const assert = require('assert');
const { resolveCommunityContext } = require('../src/commands');

const communityJid = 'community-1@g.us';
const subgroupJid = 'subgroup-1@g.us';

function socketFor({ currentMetadata, communityMetadata, linked }) {
  const calls = [];
  return {
    calls,
    groupMetadata: async () => {
      calls.push('groupMetadata');
      return currentMetadata;
    },
    communityMetadata: async () => {
      calls.push('communityMetadata');
      return communityMetadata;
    },
    communityFetchLinkedGroups: async (jid) => {
      calls.push(`communityFetchLinkedGroups:${jid}`);
      return linked;
    },
  };
}

async function run() {
  const cases = [
    {
      name: 'community',
      currentMetadata: { isCommunity: true, participants: [] },
      linked: { communityJid, isCommunity: true, linkedGroups: [{ id: subgroupJid }] },
      expectedGroups: [subgroupJid],
    },
    {
      name: 'linkedParent',
      currentMetadata: { isCommunity: false, linkedParent: communityJid, participants: [] },
      linked: { communityJid, isCommunity: true, linkedGroups: [{ id: subgroupJid }] },
      expectedGroups: [subgroupJid],
    },
    {
      name: 'missing community',
      currentMetadata: { isCommunity: false, participants: [] },
      communityMetadata: { isCommunity: false, participants: [] },
      linked: { communityJid: '', isCommunity: false, linkedGroups: [] },
      expected: null,
    },
    {
      name: 'mixed groups',
      currentMetadata: { isCommunity: false, parentGroupId: communityJid, participants: [] },
      linked: {
        communityJid,
        isCommunity: true,
        linkedGroups: [{ id: subgroupJid }, { id: null }, { subject: 'missing id' }],
      },
      expectedGroups: [subgroupJid],
    },
  ];

  for (const testCase of cases) {
    const sock = socketFor(testCase);
    const result = await resolveCommunityContext({ jid: subgroupJid, sock });
    if (testCase.expected === null) {
      assert.strictEqual(result, null, testCase.name);
      assert.deepStrictEqual(sock.calls, ['groupMetadata', 'communityMetadata'], testCase.name);
      continue;
    }
    assert.ok(result, testCase.name);
    assert.strictEqual(result.communityJid, communityJid, testCase.name);
    assert.deepStrictEqual(result.groups.map((group) => group.id), testCase.expectedGroups, testCase.name);
    assert.strictEqual(sock.calls[0], 'groupMetadata', testCase.name);
  }
}

run().then(() => console.log('CA community smoke tests passed.'));
