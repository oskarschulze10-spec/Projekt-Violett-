'use strict';

const assert = require('assert');
const { getStaffRank } = require('../src/commands');

const normalizeJid = (jid) => String(jid || '').split('@')[0].split(':')[0];
const base = {
  sender: '491700000001',
  senderLid: '123456789@lid',
  phoneNumber: '491700000001',
  ownerNumbers: ['491700000099'],
  data: {
    users: {},
    coOwners: [],
    botDesigners: ['491700000001'],
    mods: [],
    groupVictims: [],
    support: [],
  },
  normalizeJid,
};

assert.strictEqual(getStaffRank(base), 'Bot_Designer · Level 2');

const lidOnly = {
  ...base,
  sender: '123456789',
  senderLid: '123456789@lid',
  phoneNumber: null,
  data: { ...base.data, botDesigners: ['123456789@lid'] },
};
assert.strictEqual(getStaffRank(lidOnly), 'Bot_Designer · Level 2');

const storedAccount = {
  ...base,
  sender: '123456789',
  senderLid: null,
  phoneNumber: null,
  data: {
    ...base.data,
    botDesigners: ['491700000001'],
    users: {
      '123456789': {
        phoneNumber: '491700000001',
        lid: '123456789@lid',
        lids: ['987654321@lid'],
      },
    },
  },
};
assert.strictEqual(getStaffRank(storedAccount), 'Bot_Designer · Level 2');

console.log('staff rank regression tests passed.');
