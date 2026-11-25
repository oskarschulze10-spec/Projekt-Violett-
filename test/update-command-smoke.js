'use strict';

const assert = require('assert');
const { commands } = require('../src/commands');

const command = commands.get('update');
assert.ok(command, 'update command is registered');
assert.ok(command.names.includes('update'), 'update command has its canonical name');
assert.strictEqual(command.allowPrivate, true, 'owner can run update in a private chat');
assert.strictEqual(command.allowUnregistered, true, 'update does not require user registration');

console.log('stable update command smoke test passed.');
