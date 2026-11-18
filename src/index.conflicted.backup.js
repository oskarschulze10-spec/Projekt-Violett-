const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const {
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const { loadConfig } = require('./config');
const { createDataStore, PRIVACY_VERSION } = require('./data-store');
const { commands, createCommandContext } = require('./commands');

function normalizedJid(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

<<<<<<< Updated upstream
function migrateUserAlias(data, alias, canonical) {
  if (!data || !alias || !canonical || alias === canonical) return;
  data.userAliases ||= {};
  data.userAliases[alias] = canonical;

  const oldAccount = data.users?.[alias];
  if (oldAccount) {
    data.users[canonical] ||= oldAccount;
    if (data.users[canonical] !== oldAccount) {
      const currentAccount = data.users[canonical];
      currentAccount.bitcoin = (Number(currentAccount.bitcoin) || 0) + (Number(oldAccount.bitcoin ?? oldAccount.coins) || 0);
      currentAccount.inventory = [...new Set([
        ...(Array.isArray(currentAccount.inventory) ? currentAccount.inventory : []),
        ...(Array.isArray(oldAccount.inventory) ? oldAccount.inventory : []),
      ])];
      for (const [key, value] of Object.entries(oldAccount)) {
        if (key === 'bitcoin' || key === 'coins' || key === 'inventory') continue;
        if (currentAccount[key] === undefined || currentAccount[key] === null || currentAccount[key] === '') {
          currentAccount[key] = value;
        }
      }
    }
    delete data.users[alias];
  }

  const oldTodos = data.userTodos?.[alias];
  if (oldTodos) {
    data.userTodos[canonical] ||= [];
    const knownIds = new Set(data.userTodos[canonical].map((todo) => todo.id));
    for (const todo of oldTodos) {
      if (!knownIds.has(todo.id)) data.userTodos[canonical].push(todo);
    }
    delete data.userTodos[alias];
  }
}

async function resolveSenderNumber(sock, messageKey, data) {
  const isGroup = String(messageKey?.remoteJid || '').endsWith('@g.us');
=======
function phoneNumberFromStoredLid(data, candidates) {
  const lids = candidates.map(normalizedLid).filter(Boolean).map(normalizedJid);
  if (!lids.length) return null;
  const account = Object.values(data?.users || {}).find((entry) => (
    entry?.phoneNumber
    && [entry.lid, ...(Array.isArray(entry.lids) ? entry.lids : [])]
      .some((lid) => lids.includes(normalizedJid(lid)))
  ));
  return account?.phoneNumber ? normalizedJid(account.phoneNumber) : null;
}

async function resolveSenderPhoneNumber(sock, messageKey, data) {
>>>>>>> Stashed changes
  const candidates = [
    messageKey?.participantAlt,
    messageKey?.participant,
    ...(!isGroup ? [messageKey?.remoteJidAlt, messageKey?.remoteJid] : []),
  ].filter((jid) => typeof jid === 'string' && jid.includes('@'));
  const phoneJid = candidates.find((jid) => (
    jid.endsWith('@s.whatsapp.net') || jid.endsWith('@hosted')
  ));
  const lidCandidates = candidates.filter((jid) => (
    jid.endsWith('@lid') || jid.endsWith('@hosted.lid')
  ));

  if (phoneJid) {
    const canonical = normalizedJid(phoneJid);
    for (const lid of lidCandidates) migrateUserAlias(data, normalizedJid(lid), canonical);
    return canonical;
  }

  const lidMapping = sock.signalRepository?.lidMapping;
  if (lidMapping?.getPNForLID) {
    for (const jid of lidCandidates) {
      try {
        const phone = await lidMapping.getPNForLID(jid);
        if (phone) {
          const canonical = normalizedJid(phone);
          migrateUserAlias(data, normalizedJid(jid), canonical);
          return canonical;
        }
      } catch (error) {
        console.error(`LID-Zuordnung für ${jid} konnte nicht geladen werden:`, error.message);
      }
    }
  }
<<<<<<< Updated upstream

  data && (data.userAliases ||= {});
  for (const jid of lidCandidates) {
    const alias = normalizedJid(jid);
    const canonical = data?.userAliases?.[alias];
    if (canonical) return canonical;
  }
=======
  return phoneNumberFromStoredLid(data, candidates);
}

async function resolveSenderNumber(sock, messageKey) {
  const phoneNumber = await resolveSenderPhoneNumber(sock, messageKey);
  if (phoneNumber) return phoneNumber;
  const candidates = [
    messageKey?.participantAlt,
    messageKey?.remoteJidAlt,
    messageKey?.participant,
    messageKey?.remoteJid,
  ].filter(Boolean);
>>>>>>> Stashed changes
  return normalizedJid(candidates[0]);
}

function normalizedLid(jid) {
  const value = String(jid || '');
  const separator = value.lastIndexOf('@');
  if (separator < 0) return null;
  const server = value.slice(separator);
  if (server !== '@lid' && server !== '@hosted.lid') return null;
  return `${value.slice(0, separator).split(':')[0]}${server}`;
}

async function resolveSenderLid(sock, messageKey, phoneNumber) {
  const candidates = [
    messageKey?.participant,
    messageKey?.participantAlt,
    messageKey?.remoteJid,
    messageKey?.remoteJidAlt,
  ].filter(Boolean);
  const lidJid = candidates.map(normalizedLid).find(Boolean);
  if (lidJid) return lidJid;

  const lidMapping = sock.signalRepository?.lidMapping;
  if (phoneNumber && lidMapping?.getLIDForPN) {
    try {
      return normalizedLid(await lidMapping.getLIDForPN(`${phoneNumber}@s.whatsapp.net`));
    } catch (error) {
      console.error(`LID-Zuordnung für ${phoneNumber} konnte nicht geladen werden:`, error.message);
    }
  }
  return null;
}

function assertAuthAccount(state, config) {
  const accountJid = String(state?.creds?.me?.id || '');
  if (!accountJid.endsWith('@s.whatsapp.net')) return;
  const accountNumber = normalizedJid(accountJid);
  if (accountNumber !== config.botNumber) {
    throw new Error(
      `Der Auth-Ordner ist mit ${accountNumber} gekoppelt, erwartet wird aber BOT_NUMBER ${config.botNumber}. `
      + 'Nutze einen eigenen AUTH_DIRECTORY für das Bot-Konto; die bestehende Owner-Sitzung bleibt unverändert.',
    );
  }
}

function resetBotAuth(state, config) {
  const authDirectory = path.resolve(config.authDirectory);
  const dataFile = path.resolve(config.dataFile);
  if (authDirectory === path.parse(authDirectory).root || authDirectory === path.resolve('.')) {
    throw new Error('Der Bot-Auth-Ordner ist zu allgemein; automatisches Zurücksetzen wurde verweigert.');
  }
  const dataRelativePath = path.relative(authDirectory, dataFile);
  if (!dataRelativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(dataRelativePath)) {
    throw new Error('Die Bot-Datendatei liegt im Auth-Ordner; automatisches Zurücksetzen wurde verweigert.');
  }
  const accountJid = String(state?.creds?.me?.id || '');
  if (accountJid.endsWith('@s.whatsapp.net')) {
    const accountNumber = normalizedJid(accountJid);
    if (accountNumber !== config.botNumber) {
      throw new Error(
        `Der Auth-Ordner gehört ${accountNumber}, nicht BOT_NUMBER ${config.botNumber}; er wurde nicht verändert.`,
      );
    }
  }
  fs.rmSync(authDirectory, { recursive: true, force: true });
}

function unwrapMessage(message) {
  let content = message;
  while (content) {
    const wrapper = content.ephemeralMessage
      || content.viewOnceMessage
      || content.viewOnceMessageV2
      || content.viewOnceMessageV2Extension
      || content.documentWithCaptionMessage;
    if (!wrapper?.message) break;
    content = wrapper.message;
  }
  return content || {};
}

function interactiveButtonId(content) {
  const params = content?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (typeof params === 'string') {
    try {
      const parsed = JSON.parse(params);
      return parsed.id || parsed.selectedId || parsed.row_id || parsed.button_id || '';
    } catch (error) {
      console.error('Interaktive Menüantwort enthält ungültiges JSON:', error);
    }
  }
  return '';
}

function messageText(message) {
  const content = unwrapMessage(message?.message);
  return content.conversation
    || content.extendedTextMessage?.text
    || content.imageMessage?.caption
    || content.videoMessage?.caption
    || content.documentMessage?.caption
    || content.buttonsResponseMessage?.selectedButtonId
    || content.listResponseMessage?.singleSelectReply?.selectedRowId
    || content.templateButtonReplyMessage?.selectedId
    || interactiveButtonId(content)
    || '';
}

function messageTimestampMs(message) {
  const timestamp = Number(message.messageTimestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Date.now();
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function commandFromText(text, prefix) {
  const value = String(text || '').trim();
  if (!value.startsWith(prefix)) return null;
  const [name, ...args] = value.slice(prefix.length).trim().split(/\s+/);
  return name ? { name: name.toLowerCase(), args } : null;
}

function isBanned(data, sender) {
  const ban = data.bans[sender];
  if (!ban) return false;
  if (ban.permanent || ban.until > Date.now()) return true;
  delete data.bans[sender];
  return false;
}

function commandSocketWithDesign(sock, jid, design) {
  let designSent = false;
  const replaceMessage = (targetJid) => {
    if (targetJid !== jid) return null;
    if (designSent) return undefined;
    designSent = true;
    return sock.sendMessage(targetJid, { text: design });
  };
  const commandSock = new Proxy(sock, {
    get(target, property) {
      if (property === 'sendMessage') {
        return (targetJid, ...args) => {
          const replacement = replaceMessage(targetJid);
          return replacement === null
            ? target.sendMessage(targetJid, ...args)
            : replacement;
        };
      }
      if (property === 'relayMessage') {
        return (targetJid, ...args) => {
          const replacement = replaceMessage(targetJid);
          return replacement === null
            ? target.relayMessage(targetJid, ...args)
            : replacement;
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return {
    sock: commandSock,
    async sendDesignIfNeeded() {
      if (!designSent) {
        designSent = true;
        await sock.sendMessage(jid, { text: design });
      }
    },
  };
}

async function dispatchMessage({
  sock,
  message,
  data,
  saveData,
  config,
  logger,
  receivedAt = Date.now(),
}) {
  if (!message.key?.remoteJid) return false;
  const isGroup = message.key.remoteJid.endsWith('@g.us');
  const fromMe = Boolean(message.key.fromMe);
  if (fromMe && (!isGroup || normalizedJid(sock.user?.id) !== config.botNumber)) return false;
  const phoneNumber = fromMe
    ? config.botNumber
    : await resolveSenderPhoneNumber(sock, message.key, data);
  const candidates = [
    message.key?.participantAlt,
    message.key?.remoteJidAlt,
    message.key?.participant,
    message.key?.remoteJid,
  ].filter(Boolean);
  const sender = fromMe ? config.botNumber : (phoneNumber || normalizedJid(candidates[0]));
  const isOwner = config.ownerNumbers.includes(sender);
  if (!isGroup && !isOwner) return false;

  const prefix = data.settings.prefix || config.prefix;
  const text = messageText(message);
  if (!String(text).trimStart().startsWith(prefix)) return false;
<<<<<<< Updated upstream
  const isGroup = message.key.remoteJid.endsWith('@g.us');
  const sender = await resolveSenderNumber(sock, message.key, data);
  const isOwner = config.ownerNumbers.includes(sender);
=======
>>>>>>> Stashed changes
  if (isGroup && data.groupIgnore[message.key.remoteJid] && !isOwner) return false;
  if (!isGroup && data.blockedPrivateChats.includes(sender) && !isOwner) return false;
  if (isBanned(data, sender) && !isOwner) return false;
  if (data.ignoredBots?.includes(sender) && !isOwner) return false;

  const parsed = commandFromText(text, prefix);
  if (!parsed) return false;
  const resolvedName = data.aliases[parsed.name] || parsed.name;
  if (!isOwner) {
    const account = data.users[sender];
    const onboardingCommands = new Set(['dsgvo', 'register', 'privacy', 'deleteaccount']);
    if ((!account?.privacyAccepted || account.privacyVersion !== PRIVACY_VERSION)
      && !['dsgvo', 'privacy', 'deleteaccount'].includes(resolvedName)) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `🔒 Akzeptiere zuerst die Datenschutzinformationen mit ${prefix}dsgvo.`,
      });
      return true;
    }
    if ((!account?.registeredAt || !account.phoneNumber)
      && !onboardingCommands.has(resolvedName)) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `🔒 Registriere dich zuerst mit ${prefix}register <Name>.`,
      });
      return true;
    }
  }
  const command = commands.get(resolvedName);
  if (!command) return false;
  logger?.info({
    event: 'command_received',
    command: resolvedName,
    chatType: isGroup ? 'group' : 'private',
    senderRole: isOwner ? 'owner' : 'user',
  }, 'command received');

  if (data.settings.maintenance && !isOwner && !['maintenance', 'maint'].includes(resolvedName)) {
    await sock.sendMessage(message.key.remoteJid, {
      text: '🔧 Der Bot befindet sich gerade im Wartungsmodus.',
    });
    return true;
  }
  if (data.settings.commandMaintenance?.[resolvedName] && !isOwner) {
    await sock.sendMessage(message.key.remoteJid, {
      text: `🔧 Der Befehl ${prefix}${resolvedName} ist vorübergehend in Wartung.`,
    });
    return true;
  }

  const canonicalName = command.names[0];
  const design = data.settings.commandDesigns?.[canonicalName];
  const designSocket = typeof design === 'string' && design.trim()
    ? commandSocketWithDesign(sock, message.key.remoteJid, design)
    : null;

  const senderLid = isGroup ? await resolveSenderLid(sock, message.key, phoneNumber) : null;
  const account = data.users[sender];
  if (account?.privacyAccepted
    && account.privacyVersion === PRIVACY_VERSION
    && phoneNumber
    && senderLid) {
    const knownLids = new Set([
      account.lid,
      ...(Array.isArray(account.lids) ? account.lids : []),
    ].filter(Boolean));
    if (!knownLids.has(senderLid)) {
      account.lid ||= senderLid;
      account.lids = [...knownLids, senderLid];
      saveData();
    }
  }
  const context = createCommandContext({
    sock: designSocket?.sock || sock,
    message,
    data,
    saveData,
    jid: message.key.remoteJid,
    sender,
    phoneNumber,
    senderLid,
    isGroup,
    args: parsed.args,
    prefix,
    ownerNumber: config.ownerNumber,
    ownerNumbers: config.ownerNumbers,
    responseDelayMs: Math.max(0, Date.now() - receivedAt),
    commandName: resolvedName,
    rawText: text,
    normalizeJid: normalizedJid,
  });
  try {
    await command.handler(context);
    if (designSocket) await designSocket.sendDesignIfNeeded();
  } catch (error) {
    console.error(`Befehl ${resolvedName} ist fehlgeschlagen:`, error);
    try {
      await sock.sendMessage(message.key.remoteJid, {
        text: error?.data === 403 || error?.output?.payload?.statusCode === 403
          ? 'WhatsApp hat die Gruppenaktion verweigert (403). Prüfe, ob die Bot-Nummer in dieser Gruppe Admin ist und die Aktion für das Zielmitglied erlaubt ist. Die Owner-Rolle im Bot verleiht keine WhatsApp-Adminrechte.'
          : 'Beim Ausführen des Befehls ist ein Fehler aufgetreten.',
      });
    } catch (replyError) {
      console.error(`Fehlermeldung zu ${resolvedName} konnte nicht gesendet werden:`, replyError);
    }
  }
  return true;
}

async function startBot(config = loadConfig()) {
  const store = createDataStore(config.dataFile);
  const logger = pino({
    level: config.logLevel,
    transport: {
      target: require.resolve('pino-pretty'),
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: true,
      },
    },
  });
  let reconnectTimer;
  let activeSocket;
  let stopping = false;

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDirectory);
    assertAuthAccount(state, config);
    const sock = makeWASocket(createBaileysConfig(state, logger));
    activeSocket = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ qr }) => {
      if (!qr) return;
      console.log(`WhatsApp-QR-Code für das Bot-Konto ${config.botNumber}:`);
      qrcode.generate(qr, { small: true });
      console.log('Mit WhatsApp auf dem Bot-Konto scannen: Verknüpfte Geräte > Gerät hinzufügen.');
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const message of messages) {
        try {
          await dispatchMessage({
            sock,
            message,
            data: store.data,
            saveData: store.saveData,
            config,
            logger,
            receivedAt: messageTimestampMs(message),
          });
        } catch (error) {
          console.error('Eingehende Nachricht konnte nicht verarbeitet werden:', error);
        }
      }
    });
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        console.log('');
        console.log('\x1b[95m╭────────────────────────────────────────────╮');
        console.log('│           🌸  PROJECT VIOLETTE  🌸          │');
        console.log('├────────────────────────────────────────────┤');
        console.log(`│  Status   \x1b[92m● ONLINE\x1b[95m                            │`);
        console.log(`│  Bot      ${normalizedJid(sock.user?.id).padEnd(34)}│`);
        console.log(`│  Owner    ${config.ownerNumber.padEnd(34)}│`);
        console.log(`│  Befehle  beginnen mit ${config.prefix.padEnd(17)}│`);
        console.log('╰────────────────────────────────────────────╯\x1b[0m');
        console.log('');
        return;
      }
      if (connection !== 'close' || stopping) return;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        try {
          resetBotAuth(state, config);
        } catch (error) {
          console.error('Abgemeldete Bot-Sitzung konnte nicht sicher zurückgesetzt werden:', error.message);
          return;
        }
        console.error('Bot-Sitzung abgemeldet; Bot-Anmeldung wird zurückgesetzt und ein neuer QR-Code angefordert.');
      }
      if (reconnectTimer) return;
      console.error(`Verbindung getrennt (Status ${statusCode || 'unbekannt'}); neuer Verbindungsversuch in 5 Sekunden.`);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        connect().catch((error) => console.error('Neuverbindung fehlgeschlagen:', error));
      }, 5000);
    });

    return sock;
  }

  const sock = await connect();
  process.once('SIGINT', () => {
    stopping = true;
    clearTimeout(reconnectTimer);
    activeSocket?.end(new Error('SIGINT'));
  });
  process.once('SIGTERM', () => {
    stopping = true;
    clearTimeout(reconnectTimer);
    activeSocket?.end(new Error('SIGTERM'));
  });
  return sock;
}

function createBaileysConfig(auth, logger) {
  return {
    auth,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
  };
}

if (require.main === module) {
  startBot().catch((error) => {
    console.error('Bot konnte nicht gestartet werden:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  commandFromText,
  dispatchMessage,
  assertAuthAccount,
  resetBotAuth,
  interactiveButtonId,
  messageText,
  messageTimestampMs,
  normalizedJid,
  resolveSenderNumber,
  resolveSenderPhoneNumber,
  resolveSenderLid,
  createBaileysConfig,
  startBot,
  unwrapMessage,
};
