const fs = require('fs');
const path = require('path');

const DEFAULT_DATA = {
  users: {},
  userAliases: {},
  mods: [],
  support: [],
  settings: { prefix: '#' },
  groupSettings: {},
  bans: {},
  blockedPrivateChats: [],
  ignoredBots: [],
  groupIgnore: {},
  spicyGroups: {},
  aliases: {},
  userTodos: {},
  nextTodoId: 1,
  joinRequests: {},
  nextRequestId: 1,
  suggestions: {},
  nextSuggestionId: 1,
  broadcastGroups: [],
};

function createDataStore(filePath) {
  const absolutePath = path.resolve(filePath);
  let data = structuredClone(DEFAULT_DATA);
  if (fs.existsSync(absolutePath)) {
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Die Datendatei ${absolutePath} muss ein JSON-Objekt enthalten.`);
    }
    data = {
      ...DEFAULT_DATA,
      ...parsed,
      settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
    };
  }

  function saveData() {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, absolutePath);
  }

  return { data, saveData };
}

module.exports = { createDataStore, DEFAULT_DATA };
