const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PRIVACY_VERSION = 2;

const DEFAULT_DATA = {
  users: {},
  userAliases: {},
  mods: [],
  groupVictims: [],
  support: [],
  coOwners: [],
  alliancePartners: [],
  supportTickets: {},
  nextSupportId: 1,
  settings: { prefix: '#', commandDesigns: {}, joinGroup: null, supportGroup: null, botCreatedAt: null },
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
  const usersDirectory = path.join(path.dirname(absolutePath), 'users');
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
  const firstRegistration = Object.values(data.users || {})
    .map((account) => Date.parse(account?.registeredAt || ''))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0)
    .sort((a, b) => a - b)[0];
  data.settings.botCreatedAt ||= firstRegistration || Date.now();
  data.coOwners ||= [];
  data.alliancePartners ||= [];
  data.supportTickets ||= {};
  data.nextSupportId ||= 1;
  fs.mkdirSync(usersDirectory, { recursive: true });

  function saveUserRecords() {
    const records = Object.entries(data.users || {}).filter(([, account]) => (
      account?.privacyAccepted
      && account.privacyVersion === PRIVACY_VERSION
      && /^\d{7,15}$/.test(String(account.phoneNumber || ''))
      && /^\d+@(?:hosted\.)?lid$/.test(String(account.lid || ''))
    ));
    const recordFiles = new Map(records.map(([userId]) => [
      `user-${crypto.createHash('sha256').update(userId).digest('hex')}.json`,
      userId,
    ]));

    for (const fileName of fs.readdirSync(usersDirectory)) {
      if (/^user-[a-f0-9]{64}\.json$/.test(fileName) && !recordFiles.has(fileName)) {
        fs.unlinkSync(path.join(usersDirectory, fileName));
      }
    }

    for (const [fileName, userId] of recordFiles) {
      const account = data.users[userId];
      const recordPath = path.join(usersDirectory, fileName);
      const temporaryPath = `${recordPath}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, `${JSON.stringify({
        ...account,
        userId,
        phoneNumber: String(account.phoneNumber),
        lid: typeof account.lid === 'string' ? account.lid : null,
      }, null, 2)}\n`, 'utf8');
      fs.renameSync(temporaryPath, recordPath);
    }
  }

  function saveData() {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, absolutePath);
    saveUserRecords();
  }

  return { data, saveData };
}

module.exports = { createDataStore, DEFAULT_DATA, PRIVACY_VERSION };
