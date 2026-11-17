const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  commandFromText,
  dispatchMessage,
  assertAuthAccount,
  resetBotAuth,
  interactiveButtonId,
  messageText,
  normalizedJid,
  resolveSenderNumber,
  createBaileysConfig,
} = require('../src');
const { loadConfig } = require('../src/config');
const { DEFAULT_DATA } = require('../src/data-store');
const { commands } = require('../src/commands');

async function run() {
  const baileysConfig = createBaileysConfig({ creds: {} }, {});
  assert.strictEqual(baileysConfig.syncFullHistory, false);
  assert.strictEqual('shouldSyncHistoryMessage' in baileysConfig, false);

  const uniqueCommands = new Set(commands.values());
  assert.strictEqual(commands.size, 157);
  assert.strictEqual(uniqueCommands.size, 134);
  assert.ok([...uniqueCommands].every((command) => (
    typeof command.handler === 'function'
    && command.names.length > 0
    && Boolean(command.description)
  )));

  const config = loadConfig({
    OWNER_NUMBER: '+49 170 1234567',
    BOT_NUMBER: '491701234568',
    OWNER_NUMBERS: '',
    COMMAND_PREFIX: '#',
    AUTH_DIRECTORY: 'auth/test',
    DATA_FILE: 'data/test.json',
  });
  assert.strictEqual(config.ownerNumber, '491701234567');
  assert.strictEqual(config.botNumber, '491701234568');
  assert.deepStrictEqual(config.ownerNumbers, ['491701234567']);
  assert.throws(() => loadConfig({
    OWNER_NUMBER: '491701234567',
    BOT_NUMBER: '491701234567',
  }), /unterscheiden/);
  assert.strictEqual(normalizedJid('491701234567:4@s.whatsapp.net'), '491701234567');
  assert.strictEqual(await resolveSenderNumber({}, {
    remoteJid: '123456789@lid',
    remoteJidAlt: '491701234567@s.whatsapp.net',
  }), '491701234567');
  assert.strictEqual(await resolveSenderNumber({
    signalRepository: {
      lidMapping: {
        getPNForLID: async () => '491701234567:3@s.whatsapp.net',
      },
    },
  }, {
    participant: '123456789:3@lid',
    remoteJid: '123456789@g.us',
  }), '491701234567');
  const aliasedData = { users: { '123456789': { bitcoin: 250, displayName: 'Test' } }, userTodos: { '123456789': [{ id: '1', text: 'Test', done: false }] } };
  assert.strictEqual(await resolveSenderNumber({
    signalRepository: {
      lidMapping: {
        getPNForLID: async () => '491701234567@s.whatsapp.net',
      },
    },
  }, {
    participant: '123456789@lid',
    remoteJid: '987654321@g.us',
  }, aliasedData), '491701234567');
  assert.strictEqual(aliasedData.userAliases['123456789'], '491701234567');
  assert.strictEqual(aliasedData.users['491701234567'].bitcoin, 250);
  assert.strictEqual(aliasedData.userTodos['491701234567'][0].text, 'Test');
  assert.throws(() => assertAuthAccount({
    creds: { me: { id: '491701234567@s.whatsapp.net' } },
  }, config), /eigenen AUTH_DIRECTORY/);
  assert.doesNotThrow(() => assertAuthAccount({
    creds: { me: { id: '491701234568:2@s.whatsapp.net' } },
  }, config));
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'violette-auth-'));
  const temporaryAuthDirectory = path.join(temporaryDirectory, 'auth', 'bot-account');
  const temporaryDataFile = path.join(temporaryDirectory, 'data', 'bot-data.json');
  fs.mkdirSync(temporaryAuthDirectory, { recursive: true });
  fs.writeFileSync(path.join(temporaryAuthDirectory, 'creds.json'), '{}');
  assert.throws(() => resetBotAuth({
    creds: { me: { id: '491701234567@s.whatsapp.net' } },
  }, {
    ...config,
    authDirectory: temporaryAuthDirectory,
    dataFile: temporaryDataFile,
  }), /wurde nicht verändert/);
  assert.ok(fs.existsSync(temporaryAuthDirectory));
  resetBotAuth({
    creds: { me: { id: '491701234568:2@s.whatsapp.net' } },
  }, {
    ...config,
    authDirectory: temporaryAuthDirectory,
    dataFile: temporaryDataFile,
  });
  assert.ok(!fs.existsSync(temporaryAuthDirectory));
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  assert.deepStrictEqual(commandFromText('#menu1', '#'), { name: 'menu1', args: [] });
  assert.strictEqual(commandFromText('menu1', '#'), null);

  const buttonMessage = {
    interactiveResponseMessage: {
      nativeFlowResponseMessage: {
        paramsJson: JSON.stringify({ id: '#menu1' }),
      },
    },
  };
  assert.strictEqual(interactiveButtonId(buttonMessage), '#menu1');
  assert.strictEqual(messageText({ message: buttonMessage }), '#menu1');
  assert.strictEqual(messageText({
    message: {
      ephemeralMessage: {
        message: { conversation: '#ping' },
      },
    },
  }), '#ping');

  const data = structuredClone(DEFAULT_DATA);
  const sent = [];
  const relayed = [];
  const participantActions = [];
  let participantError = null;
  const sock = {
    user: { id: '491701234568:1@s.whatsapp.net' },
    sendMessage: async (jid, content) => sent.push({ jid, content }),
    relayMessage: async (jid, content, options) => relayed.push({ jid, content, options }),
    groupMetadata: async () => ({
      participants: [{ id: '491701234568:1@s.whatsapp.net', admin: 'admin' }],
    }),
    groupParticipantsUpdate: async (...args) => {
      if (participantError) throw participantError;
      participantActions.push(args);
    },
  };
  const common = {
    sock,
    data,
    saveData() {},
    config,
  };
  assert.strictEqual(await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: { conversation: 'hello bot' },
    },
  }), false);
  assert.strictEqual(sent.length, 0);

  await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: { conversation: '#ping' },
    },
  });
  assert.match(sent[0].content.text, /Pong!/);

  await dispatchMessage({
    ...common,
    message: {
      key: {
        remoteJid: '123456789@lid',
        remoteJidAlt: '491701234567@s.whatsapp.net',
        fromMe: false,
      },
      message: { conversation: '#prefix set !' },
    },
  });
  assert.match(sent[1].content.text, /Neuer Präfix: !/);
  assert.strictEqual(data.settings.prefix, '!');
  await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: { conversation: '!say' },
    },
  });
  assert.match(sent[sent.length - 1].content.text, /!say/);
  const sentBeforeOldPrefix = sent.length;
  assert.strictEqual(await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: { conversation: '#say' },
    },
  }), false);
  assert.strictEqual(sent.length, sentBeforeOldPrefix);
  data.settings.prefix = '#';

  data.ignoredBots.push('491700000001');
  assert.strictEqual(await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491700000001@s.whatsapp.net', fromMe: false },
      message: { conversation: '#ping' },
    },
  }), false);
  data.ignoredBots = [];

  const interactiveBeforeMenu = relayed.length;
  await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: { conversation: '#menu' },
    },
  });
  const homeMenu = sent[sent.length - 1].content;
  assert.ok(Buffer.isBuffer(homeMenu.image));
  assert.match(homeMenu.caption, /#menu1/);
  const menuSelector = relayed[interactiveBeforeMenu].content.listMessage;
  assert.strictEqual(menuSelector.buttonText, 'Menü öffnen');
  assert.strictEqual(menuSelector.sections[0].rows[0].rowId, '#menu1');

  await dispatchMessage({
    ...common,
    message: {
      key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
      message: buttonMessage,
    },
  });
  const categoryText = sent[sent.length - 1].content.text;
  assert.match(sent[sent.length - 2].content.caption, /Account/);
  assert.match(categoryText, /ACCOUNT GARDEN/);
  const categoryButton = relayed[interactiveBeforeMenu + 1].content.buttonsMessage.buttons[0];
  assert.strictEqual(categoryButton.buttonText.displayText, 'Zurück zum Menü');
  assert.strictEqual(categoryButton.buttonId, '#menu');

  await dispatchMessage({
    ...common,
    message: {
      key: {
        remoteJid: '123456789@g.us',
        participant: '491701234567@s.whatsapp.net',
        fromMe: false,
      },
      message: { conversation: '#menu' },
    },
  });
  assert.ok(Buffer.isBuffer(sent[sent.length - 1].content.image));
  assert.match(sent[sent.length - 1].content.caption, /#menu1/);

  const originalMods = [...data.mods];
  const originalSupport = [...data.support];
  for (const command of ['addmod', 'addsupport']) {
    await dispatchMessage({
      ...common,
      message: {
        key: { remoteJid: '491701234567@s.whatsapp.net', fromMe: false },
        message: { conversation: `#${command}` },
      },
    });
  }
  assert.deepStrictEqual(data.mods, originalMods);
  assert.deepStrictEqual(data.support, originalSupport);

  for (const command of ['kick', 'promote', 'demote']) {
    await dispatchMessage({
      ...common,
      message: {
        key: {
          remoteJid: '123456789@g.us',
          participant: '491701234567@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: `#${command}` },
      },
    });
  }
  assert.deepStrictEqual(participantActions, []);

  participantError = Object.assign(new Error('forbidden'), { data: 403 });
  await dispatchMessage({
    ...common,
    message: {
      key: {
        remoteJid: '123456789@g.us',
        participant: '491701234567@s.whatsapp.net',
        fromMe: false,
      },
      message: { conversation: '#selfpromote' },
    },
  });
  assert.match(sent[sent.length - 1].content.text, /Gruppenaktion verweigert \(403\)/);
  assert.match(sent[sent.length - 1].content.text, /Owner-Rolle im Bot verleiht keine WhatsApp-Adminrechte/);

  console.log('Bot runtime smoke tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
