const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  areJidsSameUser,
  generateWAMessageFromContent,
  proto,
} = require('@whiskeysockets/baileys');
const { PRIVACY_VERSION } = require('../data-store');

const MENU_IMAGE_PATH = path.join(__dirname, '../../assets/bot-banner.png');
const BITCOIN_PER_HOUR = 18;
const DAILY_REWARD = 45;
const WEEKLY_REWARD = 280;
const WORK_REWARD = 22;
const MAX_BET = 1000000;
const commands = new Map();
const groupOperationQueues = new Map();
const FUN_GIFS = {
  hug: 'https://media0.giphy.com/media/7Wcyq7KvKFNTO/giphy.mp4',
  kiss: 'https://media1.giphy.com/media/W1hd3uXRIbddu/giphy.mp4',
  slap: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW04dnMxcmNxaGQ0ZTVqMGtwN3JpaG03ZXlrdnFka2ZibnNnaHJ5ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/srD8JByP9u3zW/giphy.mp4',
  pat: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ21vMjZ5ZmJjaDU4OXkzdW0yOGdtNWE1YW5vcWV0eXh5Z2Q2NWJyMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/foKSo54WXpkN63rjpl/giphy.mp4',
  fuck: 'https://i.giphy.com/media/3o7TKwmnDgQb5jemjK/giphy.mp4',
  ship: 'https://media4.giphy.com/media/EYuz3e4RAYectWaWFH/giphy.mp4',
  aura: 'https://media4.giphy.com/media/qwr614iHK9bqdXfeF8/giphy.mp4',
  howgay: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnpoczZ4aTdqb3lzMW5icjl4MzF3dmloMGo1M3czNzNoOTA1MHExOCZlcD12MV9naWZfYnlfaWQmY3Q9Zw/gqCW8gcUUCbngzsqQN/giphy.mp4',
  flirt: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExODloanV3bXg5b2s4aGU3cW9rMDZjZWdjYjJlM3pwMzN0cjdreTJvdyZlcD12MV9naWZfYnlfaWQmY3Q9Zw/sWBzg2D15WwQjHcxbt/giphy.mp4',
  cuddle: 'https://media4.giphy.com/media/chpVje4XVoDLnDQ7XJ/giphy.mp4',
  highfive: 'https://media1.giphy.com/media/SsyFAgnM1s3jfFeroV/giphy.mp4',
  blush: 'https://media.giphy.com/media/aCSURh6OnUyXdOuYcq/giphy.mp4',
  comfort: 'https://media4.giphy.com/media/SHyuhBtRr8Zeo/giphy.mp4',
  wink: 'https://media1.giphy.com/media/12kFpziiPAVYTC/giphy.mp4',
  wave: 'https://media.giphy.com/media/DHYNyjAqrqkzm/giphy.mp4',
  bonk: 'https://media.giphy.com/media/30lxTuJueXE7C/giphy.mp4'
};

function register(names, description, handler, options = {}) {
  const command = { names, description, handler, ...options };
  for (const name of names) commands.set(name, command);
}





function mentionJids(context) {
  const mentioned = context.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  return mentioned;
}

function targetNumber(context, value) {
  const mentioned = context.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target = mentioned[0] || value;
  return context.normalizeJid(target);
}

function user(context, jid = context.sender) {
  const id = context.normalizeJid(jid);
  context.data.users[id] ||= { bitcoin: 0, lastHourly: 0 };
  const account = context.data.users[id];
  if (typeof account.bitcoin !== 'number') account.bitcoin = Number(account.coins) || 0;
  delete account.coins;
  account.lastDaily ||= 0;
  account.lastWeekly ||= 0;
  account.lastWork ||= 0;
  account.inventory ||= [];
  account.vipUntil ||= 0;
  account.luck ||= 0;
  account.rank ||= 'standard';
  account.bankAccount ||= null;
  return account;
}

function displayName(context, number) {
  return `@${displayUser(context, number)}`;
}

function displayUser(context, number) {
  const normalized = context.normalizeJid(number);
  const name = user(context, `${normalized}@s.whatsapp.net`).displayName;
  return name || normalized;
}

async function resolvePhoneNumber(context, jid) {
  const normalized = context.normalizeJid(jid);
  const accounts = Object.values(context.data.users || {});
  const account = accounts.find((entry) => (
    entry?.phoneNumber
    && (
      context.normalizeJid(entry.phoneNumber) === normalized
      || context.normalizeJid(entry.lid) === normalized
      || (Array.isArray(entry.lids) && entry.lids.some((lid) => context.normalizeJid(lid) === normalized))
    )
  ));
  if (account?.phoneNumber) return context.normalizeJid(account.phoneNumber);

  const lidMapping = context.sock.signalRepository?.lidMapping;
  if (normalized && lidMapping?.getPNForLID) {
    const candidates = [String(jid || '')];
    if (!candidates[0].endsWith('@lid') && !candidates[0].endsWith('@hosted.lid')) {
      candidates.push(`${normalized}@lid`);
    }
    for (const candidate of candidates) {
      if (!candidate.endsWith('@lid') && !candidate.endsWith('@hosted.lid')) continue;
      try {
        const phoneNumber = await lidMapping.getPNForLID(candidate);
        if (phoneNumber) return context.normalizeJid(phoneNumber);
      } catch (error) {
        console.error(`LID-Zuordnung für ${candidate} konnte nicht geladen werden:`, error.message);
      }
    }
  }
  return normalized;
}

function mentionJid(context, number) {
  const normalized = context.normalizeJid(number);
  const mentioned = context.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const matchedMention = mentioned.find((jid) => context.normalizeJid(jid) === normalized);
  if (matchedMention) return matchedMention;
  const quotedParticipant = context.message.message?.extendedTextMessage?.contextInfo?.participant;
  if (quotedParticipant && context.normalizeJid(quotedParticipant) === normalized) return quotedParticipant;
  return `${normalized}@s.whatsapp.net`;
}

function requireRole(context, role) {
  const number = context.normalizeJid(context.sender);
  if (context.ownerNumbers?.includes(number) || number === context.ownerNumber) return true;
  const senderIds = new Set([
    number,
    context.normalizeJid(context.senderLid),
  ].filter(Boolean));
  const hasRole = (members) => (members || []).some((member) => (
    senderIds.has(context.normalizeJid(member))
  ));
  const isCoOwner = hasRole(context.data.coOwners);
  const isModerator = hasRole(context.data.mods) || hasRole(context.data.groupVictims) || hasRole(context.data.botDesigners);
  if (role === 'coowner' && isCoOwner) return true;
  if (role === 'mod' && (isCoOwner || isModerator)) return true;
  if (role === 'support' && (isCoOwner || isModerator || hasRole(context.data.support))) return true;
  return false;
}

function isOwner(context, number) {
  return (context.ownerNumbers || [context.ownerNumber]).includes(number);
}

function isCurrentOwner(context) {
  return isOwner(context, context.normalizeJid(context.sender));
}

function getStaffRank(context) {
  const normalize = context.normalizeJid;
  const identifiers = new Set([
    context.sender,
    context.senderLid,
    context.phoneNumber,
  ].map(normalize).filter(Boolean));

  for (const [userId, account] of Object.entries(context.data?.users || {})) {
    const accountIds = [
      userId,
      account?.phoneNumber,
      account?.lid,
      ...(Array.isArray(account?.lids) ? account.lids : []),
    ].map(normalize).filter(Boolean);
    if (accountIds.some((id) => identifiers.has(id))) {
      for (const id of accountIds) identifiers.add(id);
    }
  }

  const hasRole = (members) => (members || []).some((member) => (
    identifiers.has(normalize(member))
  ));
  if ((context.ownerNumbers || [context.ownerNumber]).some((owner) => identifiers.has(normalize(owner)))) return 'Owner';
  if (hasRole(context.data?.coOwners)) return 'Co-Owner · Level 3';
  if (hasRole(context.data?.botDesigners)) return 'Bot_Designer · Level 2';
  if (hasRole(context.data?.mods) || hasRole(context.data?.groupVictims)) return 'Moderator · Level 2';
  if (hasRole(context.data?.support)) return 'Supporter · Level 1';
  return 'Member';
}


function requireGroup(context) {
  if (context.isGroup) return true;
  context.reply('Dieser Befehl funktioniert nur in einer Gruppe.');
  return false;
}

function commandPrefix(context) {
  return context.prefix || '#';
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function quotedNumber(context) {
  const info = context.message.message?.extendedTextMessage?.contextInfo;
  const mentionedJid = info?.mentionedJid?.[0];
  if (mentionedJid) return context.normalizeJid(mentionedJid);
  const quotedJid = info?.participant || (!context.isGroup ? context.jid : '');
  return context.normalizeJid(quotedJid);
}

function funTarget(context) {
  const number = quotedNumber(context);
  return number || context.normalizeJid(context.sender);
}

async function sendFunGif(context, type, text) {
  const response = await fetch(FUN_GIFS[type]);
  if (!response.ok) {
    throw new Error(`GIF konnte nicht geladen werden (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await context.sock.sendMessage(context.jid, {
    video: buffer,
    gifPlayback: true,
    mimetype: 'video/mp4',
    caption: text,
    mentions: [
      mentionJid(context, context.sender),
      mentionJid(context, funTarget(context)),
    ],
  });

}

const MENU_CATEGORIES = {
  1: {
    title: '👤 ACCOUNT',
    commands: [
      ['register <name>'], ['dsgvo'], ['profile'], ['account'], ['privacy'],
      ['deleteaccount'], ['usertodo add|list|done|clear'], ['me'],
    ],
  },
  2: {
    title: '✨ FUN ZONE',
    commands: [
      ['aura [@user]'], ['howgay [@user]'], ['slap @user'], ['pat @user'],
      ['highfive @user'], ['blush @user'], ['wink @user'], ['comfort @user'],
      ['wave @user'], ['bonk @user'], ['joke'], ['8ball <question>'],
      ['rate <text>'],
    ],
  },
  3: {
    title: '💎 ECONOMY',
    commands: [
      ['daily'], ['weekly'], ['work'], ['shop'], ['buy <item>'], ['inventory'],
      ['überweisung @user <amount>'], ['bankkonto [bank]'], ['bankeinzahlung <amount>'],
      ['bankauszahlung <amount>'], ['banktransfer @user <amount>'], ['top'],
      ['interest'], ['deposit <amount> [days]'], ['economy'],
    ],
  },
  4: {
    title: '🛡️ GROUP MODERATION',
    accessRole: 'mod',
    commands: [
      ['kick @user'], ['warn @user [reason]'], ['warnings @user'], ['clearwarns @user'],
      ['mute @user <minutes>'], ['unmute @user'], ['antilink on|off'],
      ['antisticker on|off'], ['promote @user'], ['demote @user'],
      ['tagall [text]'], ['lock on|off'], ['slowmode <seconds>'], ['clear'],
    ],
  },
  5: {
    title: '🌐 COMMUNITY',
    commands: [
      ['community'], ['staffrank'], ['alliance list'], ['join <group link>'],
      ['support <message>'], ['suggest <idea>'], ['suggestions'],
    ],
  },
  6: {
    title: '🎧 SUPPORTER MENU',
    accessRole: 'support',
    commands: [
      ['supportreply <ticket ID> <message>'], ['supportclose <ticket ID>'],
      ['teamlist'], ['modinfo'], ['teamhelp'],
    ],
  },
  7: {
    title: '🛡️ MODERATOR MENU',
    accessRole: 'mod',
    commands: [
      ['warn @user [reason]'], ['warnings @user'], ['clearwarns @user'],
      ['mute @user <minutes>'], ['unmute @user'], ['kick @user'],
      ['antilink on|off'], ['antisticker on|off'], ['lock on|off'],
      ['slowmode <seconds>'], ['tagall [text]'], ['approvejoin <id>'],
      ['rejectjoin <id>'], ['teamlist'], ['modinfo'],
    ],
  },
  8: {
    title: '👑 CO-OWNER MENU',
    accessRole: 'coowner',
    commands: [
      ['modmenu'], ['supportmenu'], ['community'], ['alliance add|remove|list'],
      ['approvejoin <id>'], ['rejectjoin <id>'], ['setjoingroup'],
      ['setsupportgroup'],
    ],
  },
  9: {
    title: '💜 OWNER MENU',
    accessRole: 'owner',
    commands: [
      ['addcoowner @user'], ['delcoowner @user'], ['addmod @user'],
      ['delmod @user'], ['addbotdesigner @user'], ['delbotdesigner @user'],
      ['addsupport @user'], ['delsupport @user'],
      ['removeaccount confirm @user'], ['setjoingroup'], ['setsupportgroup'],
      ['alliance add|remove|list'], ['botstats'], ['prefix set <symbol>'],
      ['setdesign <command> <text>'], ['resetdesign <command>'],
      ['maintenance'], ['reload'],
    ],
  },
};

function canAccessMenu(context, category) {
  const menu = MENU_CATEGORIES[category];
  return Boolean(menu && (!menu.accessRole || requireRole(context, menu.accessRole)));
}

function isSpicyMenuVisible(context) {
  return Boolean(context?.data?.spicyGroups?.[context.jid]);
}

function renderMenu(category, prefix = '#', context) {
  const menuStyle = {
    1: ['01', '👤', 'ACCOUNT'],
    2: ['02', '✨', 'FUN ZONE'],
    3: ['03', '💎', 'ECONOMY'],
    4: ['04', '🛡️', 'GROUP MODERATION'],
    5: ['05', '🌐', 'COMMUNITY'],
  };
  const visibleCategories = Object.entries(MENU_CATEGORIES)
    .filter(([number]) => canAccessMenu(context, number));

  if (!category) {
    return [
      '╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮',
      '       💜 PROJECT VIOLETTÉ',
      '             NEXUS V8',
      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
      '',
      '  ◈ CONTROL CENTER · ONLINE',
      '',
      ...visibleCategories.map(([number, menu]) => {
        const [id, icon, label] = menuStyle[number] || [number, '✦', menu.title];
        return '  ┏ ' + id + '  ' + icon + '  ' + label + '\n  ┗ ' + prefix + 'menu' + number;
      }),
      '',
      '  ────────────────────────────',
      '  ✦ ' + prefix + 'commands',
      '  ✦ DESIGN BY 7 · POWERED BY VIOLETTÉ',
    ].join('\n');
  }

  const menu = MENU_CATEGORIES[category];
  if (!menu || !canAccessMenu(context, category)) {
    return 'Menu unavailable. Use ' + prefix + 'menu.';
  }
  const [id, icon, label] = menuStyle[category] || [String(category), '✦', menu.title];
  return [
    '╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮',
    '       ' + icon + ' ' + label,
    '             MODULE ' + id,
    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
    '',
    ...menu.commands.map(([command], index) => (
      '  ' + String(index + 1).padStart(2, '0') + '  ' + prefix + command
    )),
    '',
    '  ────────────────────────────',
    '  ◀ ' + prefix + 'menu',
    '  ◈ DESIGN BY 7 · PROJECT VIOLETTÉ',
  ].join('\n');
}

async function sendMenu(context, category) {
  return sendInteractiveMenu(context, category);
}

async function sendInteractiveMenu(context, category) {
  const prefix = commandPrefix(context);
  const visibleCategories = Object.entries(MENU_CATEGORIES)
    .filter(([number]) => canAccessMenu(context, number));

  if (category && !canAccessMenu(context, category)) return;

  const bodyText = renderMenu(category || null, prefix, context);
  const headerTitle = category
    ? MENU_CATEGORIES[category].title
    : 'PROJECT VIOLETTÉ · NEXUS V8';
  const footerText = category
    ? 'PROJECT VIOLETTÉ · DESIGN BY 7'
    : 'DESIGN BY 7 · SYSTEM ONLINE';

  const quickReply = (label, command) => ({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: label,
      id: prefix + command,
    }),
  });

  const buttons = category
    ? [
        quickReply('Back to Nexus', 'menu'),
        quickReply('All commands', 'commands'),
      ]
    : [
        {
          name: 'single_select',
          buttonParamsJson: JSON.stringify({
            title: 'OPEN CONTROL CENTER',
            sections: [{
              title: 'AVAILABLE MODULES',
              rows: visibleCategories.map(([number, menu]) => ({
                id: prefix + 'menu' + number,
                title: menu.title,
                description: menu.commands.length
                  + ' commands · module '
                  + String(number).padStart(2, '0'),
              })),
            }],
          }),
        },
        quickReply('Refresh Nexus', 'menu'),
        quickReply('All commands', 'commands'),
      ];

  try {
    const userJid = context.sock.user?.id || context.sock.user?.jid;
    if (!userJid) throw new Error('WhatsApp-Bot-JID ist noch nicht verfügbar.');

    const interactiveMessage = proto.Message.InteractiveMessage.create({
      header: proto.Message.InteractiveMessage.Header.create({
        title: headerTitle,
        subtitle: 'NEXUS V8',
        hasMediaAttachment: false,
      }),
      body: proto.Message.InteractiveMessage.Body.create({ text: bodyText }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footerText }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: buttons.map((button) =>
          proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
            name: button.name,
            buttonParamsJson: button.buttonParamsJson,
          }),
        ),
        messageParamsJson: '{}',
        messageVersion: 1,
      }),
    });

    // WhatsApp erwartet InteractiveMessage innerhalb eines ViewOnceMessage-Umschlags.
    const generated = generateWAMessageFromContent(
      context.jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage,
          },
        },
      },
      { userJid },
    );

    await context.sock.relayMessage(context.jid, generated.message, {
      messageId: generated.key.id,
    });
  } catch (error) {
    console.error('Native-Flow-Menü konnte nicht gesendet werden:', error);
    try {
      await context.sock.sendMessage(context.jid, {
        text: bodyText + '\n\nInteraktive Buttons sind gerade nicht verfügbar.',
      });
    } catch (fallbackError) {
      console.error('Auch der Text-Fallback für das Menü ist fehlgeschlagen:', fallbackError);
      throw fallbackError;
    }
  }
}

const COMMAND_STYLES = [
  ['╭─🌸', '╰─🌸', 'VIOLETTE BLOOM'],
  ['╭─✦', '╰─✦', 'NEON SPARK'],
  ['╭─💜', '╰─💜', 'PURPLE HEART'],
  ['╭─☾', '╰─☾', 'MOONLIGHT'],
  ['╭─⚡', '╰─⚡', 'VIOLET ENERGY'],
];

function styledCommandReply(text, commandName) {
  if (typeof text !== 'string' || !text.trim()) return text;
  const index = [...String(commandName || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COMMAND_STYLES.length;
  const [open, close, label] = COMMAND_STYLES[index];
  return `${open} ${label}\n│\n│ ${text.split('\n').join('\n│ ')}\n│\n${close} ──`;
}

async function requireBotAdmin(context) {
  if (!requireGroup(context)) return false;
  const metadata = await context.sock.groupMetadata(context.jid);
  const botIds = [context.sock.user?.id, context.sock.user?.lid].filter(Boolean);
  const bot = metadata.participants.find((participant) => botIds.some((botId) => (
    participant.id === botId || areJidsSameUser(participant.id, botId)
  )));
  if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
    await context.reply('Ich muss in dieser Gruppe Admin sein, um das zu tun.');
    return false;
  }
  return metadata;
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 && amount <= MAX_BET ? amount : null;
}

function communityJidFromMetadata(metadata, currentJid) {
  const candidates = [
    metadata?.isCommunity ? currentJid : null,
    metadata?.linkedParent,
    metadata?.communityJid,
    metadata?.communityId,
    metadata?.parentGroupId,
    metadata?.parentJid,
    metadata?.parent?.id,
    metadata?.parent?.jid,
    metadata?.community?.id,
    metadata?.community?.jid,
  ];
  return candidates.find((jid) => typeof jid === 'string' && jid.endsWith('@g.us')) || '';
}

function participantIsAdmin(participant) {
  return Boolean(participant && (
    ['admin', 'superadmin'].includes(participant.admin)
    || participant.isAdmin
    || participant.isSuperAdmin
  ));
}

function participantMatchesJid(context, participant, jid) {
  return [participant?.id, participant?.lid, participant?.phoneNumber].some((candidate) => (
    candidate && (
      areJidsSameUser(candidate, jid)
      || context.normalizeJid(candidate) === context.normalizeJid(jid)
    )
  ));
}

function groupJidFromEntry(group) {
  const candidates = [
    group?.id,
    group?.jid,
    group?.groupJid,
    group?.groupId,
    group?.communityJid,
    group?.communityId,
    group?.parentGroupId,
    group?.parentJid,
  ];
  const jid = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return jid && jid.endsWith('@g.us') ? jid : (typeof group === 'string' && group.endsWith('@g.us') ? group : null);
}

function linkedCommunityGroups(result) {
  const groups = result?.linkedGroups || result?.groups || result?.linked || [];
  if (!Array.isArray(groups)) return [];
  const resolved = groups
    .map((group) => {
      const id = typeof group === 'string' ? group : groupJidFromEntry(group);
      return id ? { id } : null;
    })
    .filter(Boolean);
  return resolved;
}

async function resolveCommunityContext(context) {
  if (!context?.jid || !context.sock) return null;

  let currentMetadata = null;
  if (typeof context.sock.groupMetadata === 'function') {
    try {
      currentMetadata = await context.sock.groupMetadata(context.jid);
    } catch (error) {
      console.error('? CA: Gruppenmetadaten konnten nicht geladen werden:', error);
    }
  }

  let communityJid = communityJidFromMetadata(currentMetadata, context.jid);
  if (!communityJid && typeof context.sock.communityMetadata === 'function') {
    try {
      communityJid = communityJidFromMetadata(
        await context.sock.communityMetadata(context.jid),
        context.jid,
      );
    } catch (error) {
      console.error('? CA: Community-Metadaten konnten nicht geladen werden:', error);
    }
  }
  if (!communityJid) return null;

  if (typeof context.sock.communityFetchLinkedGroups !== 'function') {
    return currentMetadata?.isCommunity || communityJid
      ? { communityJid, groups: [] }
      : null;
  }

  const linked = await context.sock.communityFetchLinkedGroups(communityJid);
  const resolvedCommunityJid = typeof linked?.communityJid === 'string'
    && linked.communityJid.endsWith('@g.us')
    ? linked.communityJid
    : communityJid;
  const groups = linkedCommunityGroups(linked);
  return groups.length || linked?.isCommunity || currentMetadata?.isCommunity
    ? { communityJid: resolvedCommunityJid, groups }
    : null;
}

function isRateLimitError(error) {
  return error?.data === 429
    || error?.status === 429
    || error?.output?.statusCode === 429
    || /(?:429|rate.?overlimit|rate limit|too many requests)/i.test(error?.message || '');
}

function participantJid(participant) {
  return participant?.phoneNumber || participant?.id || participant?.lid || '';
}

function uniqueParticipantJids(context, participants) {
  const seen = new Set();
  return participants
    .map(participantJid)
    .filter((jid) => {
      const key = context.normalizeJid(jid);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function withGroupOperationLock(groupJid, operation) {
  const previous = groupOperationQueues.get(groupJid) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  groupOperationQueues.set(groupJid, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (groupOperationQueues.get(groupJid) === current) groupOperationQueues.delete(groupJid);
  }
}

async function runCloneUpdate(context, groupJid, participants, options) {
  let attempt = 0;
  while (true) {
    try {
      await context.sock.groupParticipantsUpdate(groupJid, participants, 'add');
      return { ok: true, rateLimited: false };
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= options.maxRetries) {
        return { ok: false, rateLimited: isRateLimitError(error), error };
      }
      const delay = options.retryBaseDelayMs * (2 ** attempt);
      attempt += 1;
      await wait(delay);
    }
  }
}

async function cloneGroup(context, subject, options = {}) {
  const settings = {
    batchSize: 5,
    batchDelayMs: 1500,
    retryBaseDelayMs: 2000,
    maxRetries: 2,
    ...options,
  };

  return withGroupOperationLock(context.jid, async () => {
    const metadata = await requireBotAdmin(context);
    if (!metadata) return null;

    const botIds = [
      context.sock.user?.id,
      context.sock.user?.lid,
      context.sock.user?.phoneNumber,
    ].filter(Boolean);
    const protectedIds = [
      context.sender,
      context.message?.key?.participantAlt,
      ...botIds,
    ].filter(Boolean);
    const protectedKeys = new Set(protectedIds.map((jid) => context.normalizeJid(jid)).filter(Boolean));
    const members = uniqueParticipantJids(context, metadata.participants || []);
    const protectedMembers = members.filter((jid) => protectedKeys.has(context.normalizeJid(jid)));
    const initialMembers = protectedMembers.length
      ? protectedMembers
      : [`${context.normalizeJid(context.sender)}@s.whatsapp.net`];
    const targets = members.filter((jid) => !protectedKeys.has(context.normalizeJid(jid)));
    const failed = [];
    let added = 0;
    let rateLimited = 0;
    let group;

    try {
      group = await context.sock.groupCreate(subject, initialMembers);
    } catch (error) {
      console.error('❌ Clone: Zielgruppe konnte nicht erstellt werden:', error);
      await context.reply('Die Zielgruppe konnte nicht erstellt werden.');
      return null;
    }

    if (metadata.desc) {
      try {
        await context.sock.groupUpdateDescription(group.id, metadata.desc);
      } catch (error) {
        console.error(`❌ Clone: Beschreibung für ${group.id} konnte nicht gesetzt werden:`, error);
      }
    }

    for (let offset = 0; offset < targets.length; offset += settings.batchSize) {
      const batch = targets.slice(offset, offset + settings.batchSize);
      const batchResult = await runCloneUpdate(context, group.id, batch, settings);
      if (batchResult.ok) {
        added += batch.length;
      } else {
        if (batchResult.rateLimited) rateLimited += 1;
        for (const jid of batch) {
          const participantResult = await runCloneUpdate(context, group.id, [jid], settings);
          if (participantResult.ok) {
            added += 1;
          } else {
            if (participantResult.rateLimited) rateLimited += 1;
            failed.push(`${jid} (Batch fehlgeschlagen, Einzelversuch fehlgeschlagen)`);
          }
        }
      }
      await context.reply(`🔄 Clone-Fortschritt: ${Math.min(offset + batch.length, targets.length)}/${targets.length} Teilnehmer verarbeitet, ${added} hinzugefügt.`);
      if (offset + settings.batchSize < targets.length) await wait(settings.batchDelayMs);
    }

    try {
      await context.sock.sendMessage(group.id, {
        text: `🌸 Gruppe geklont von Project Violette.\nQuelle: ${metadata.subject}`,
      });
    } catch (error) {
      console.error(`❌ Clone: Begrüßungsnachricht für ${group.id} konnte nicht gesendet werden:`, error);
    }

    const summary = [
      `✅ Gruppe geklont: ${subject}`,
      group.id,
      `Mitglieder: ${members.length}`,
      `Geschützt: ${initialMembers.length}`,
      `Hinzugefügt: ${added}`,
      `Fehlgeschlagen: ${failed.length}`,
    ];
    if (rateLimited) summary.push(`429/Rate-Limit: ${rateLimited} Vorgang(e) nach begrenztem Backoff`);
    if (failed.length) summary.push(`Fehler: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? ', …' : ''}`);
    return { summary: summary.join('\n'), group, failed, added };
  });
}




























function spicyEnabled(context) {
  if (!context.isGroup) return true;
  context.data.spicyGroups ||= {};
  return context.data.spicyGroups[context.jid] === true;
}

function canUseSpicy(context) {
  if (!user(context).adultConfirmed) {
    context.reply(`🔒 Bestätige zuerst mit ${commandPrefix(context)}adult yes, dass du volljährig bist.`);
    return false;
  }
  if (!spicyEnabled(context)) {
    context.reply(`🌌 Spicy ist hier deaktiviert. Owner/Mods können es mit ${commandPrefix(context)}spicy on aktivieren.`);
    return false;
  }
  return true;
}













function isVip(account) {
  return account.vipUntil > Date.now();
}

function bitcoinReward(account, amount) {
  const booster = account.boosterUntil > Date.now() ? 1.25 : 1;
  const rankMultiplier = {
    standard: 1,
    'vip-daily': 1.5,
    vip: 1.5,
    'vip-premium': 1.75,
    elite: 2,
  }[account.rank] || 1;
  return Math.floor(amount * (isVip(account) ? rankMultiplier : 1) * booster);
}











function registerSecretRole(name, field, label) {
  register([name], `${label} markieren`, async (ctx) => {
    const target = targetNumber(ctx, ctx.args[0]);
    if (!target || target === ctx.normalizeJid(ctx.sender)) {
      return ctx.reply(`Nutzung: ${commandPrefix(ctx)}${name} @Nutzer`);
    }
    const account = user(ctx);
    account[field] = target;
    ctx.saveData();
    await ctx.reply(`💜 ${label} wurde geheim markiert: ${displayName(ctx, target)}`, {
      mentions: [mentionJid(ctx, target)],
    });
  });
}











function timedRewardCommand(name, field, cooldown, baseReward, label) {
  register([name], `${label} Bitcoin abholen`, async (ctx) => {
    const account = user(ctx);
    const remaining = cooldown - (Date.now() - account[field]);
    if (remaining > 0) {
      return ctx.reply(`⏳ Wieder verfügbar in ${Math.ceil(remaining / 3600000)} Stunden.`);
    }
    const reward = bitcoinReward(account, baseReward);
    account.bitcoin += reward;
    account[field] = Date.now();
    ctx.saveData();
    await ctx.reply(`✅ ${label}: +${reward} Bitcoin. Kontostand: ${account.bitcoin}`);
  });
}






const SHOP_ITEMS = {
  'vip-daily': { price: 85, duration: 24 * 3600000, rank: 'vip-daily', description: '24 Stunden: +50% Belohnungen und VIP Daily in #me' },
  vip: { price: 1400, duration: 30 * 24 * 3600000, rank: 'vip', description: '30 Tage: +50% Belohnungen und VIP in #me' },
  'vip-premium': { price: 3200, duration: 30 * 24 * 3600000, rank: 'vip-premium', description: '30 Tage: +75% Belohnungen und Premium-Badge' },
  elite: { price: 7500, duration: 30 * 24 * 3600000, rank: 'elite', description: '30 Tage: +100% Belohnungen und Elite-Badge' },
  luck: { price: 120, duration: 7 * 24 * 3600000, description: '7 Tage: +15 Glück im Casino' },
  booster: { price: 65, duration: 24 * 3600000, description: '24 Stunden: +25% auf Arbeitsbelohnungen' },
  lupe: { price: 90, description: 'Zeigt dir deine geheim markierten Rollen in #me' },
  crown: { price: 110, description: 'Aktiviert den Royal Badge in deiner Violette-Karte' },
  rose: { price: 75, description: 'Aktiviert die Rose Aura in deinem Profil' },
  glow: { price: 95, description: 'Schaltet Neon Glow für dein Account-Theme frei' },
  signature: { price: 180, description: 'Freischaltung für den Signature Drop im Profil-Design' },
};





const BANKS = {
  kuhle: { label: 'Die Kuhle', openingFee: 10, monthlyFee: 0 },
  sparkasse: { label: 'Violette Sparkasse', openingFee: 35, monthlyFee: 4 },
  volksbank: { label: 'Violette Volksbank', openingFee: 50, monthlyFee: 3 },
  neonbank: { label: 'NeonBank', openingFee: 90, monthlyFee: 1 },
  premiumbank: { label: 'Premium Private Bank', openingFee: 250, monthlyFee: 0 },
};

function chargeBankFee(account) {
  if (!account.bankAccount) return 0;
  const bank = BANKS[account.bankAccount.bank];
  if (!bank) return 0;
  const months = Math.floor((Date.now() - account.bankAccount.lastFeeAt) / (30 * 86400000));
  if (months < 1) return 0;
  const fee = months * bank.monthlyFee;
  account.bankAccount.balance = Math.max(0, account.bankAccount.balance - fee);
  account.bankAccount.lastFeeAt = Date.now();
  return fee;
}

















async function runFunCommand(ctx, type, message) {
  const target = funTarget(ctx);
  if (!target) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}${type} @Nutzer`);
  try {
    await sendFunGif(ctx, type, message(target));
  } catch (error) {
    console.error(`❌ GIF ${type}:`, error);
    await ctx.reply(`⚠️ Die ${type}-Animation konnte gerade nicht geladen werden.`);
  }
}

























const CUTE_FUN_COMMANDS = [
  ['cuddle', 'Nutzer kuscheln', 'cuddle', '🫂 {sender} kuschelt sich gemütlich an {target}!'],
  ['highfive', 'High-Five geben', 'highfive', '⚡ {sender} gibt {target} ein glänzendes Neon-High-Five!'],
  ['blush', 'Verlegen werden', 'blush', '💜 {sender} wird wegen {target} ganz verlegen!'],
  ['wink', 'Mysteriös zuzwinkern', 'wink', '🌙 {sender} zwinkert {target} geheimnisvoll zu!'],
  ['comfort', 'Nutzer trösten', 'comfort', '🌌 {sender} tröstet {target} und bleibt an ihrer Seite.'],
  ['wave', 'Nutzer zuwinken', 'wink', '✨ {sender} winkt {target} aus der Neon-Nacht zu!'],
  ['bonk', 'Nutzer spielerisch bonken', 'slap', '🔮 {sender} bonkt {target} ganz sanft mit einem magischen Hammer!'],
  ['flirt', 'Nutzer verspielt anflirten', 'flirt', '💜 {sender} flirtet ganz offensichtlich mit {target} ✨'],
];



const SPICY_COMMANDS = [
  ['seduce', 'Nicht-grafisch verführen', null, '🌙 {sender} versucht, {target} mit mystischer Neon-Energie zu verführen 🔮'],
  ['makeout', 'Intensiven Kuss andeuten', null, '💋 {sender} und {target} kommen sich für einen intensiven Kuss näher …'],
  ['private', 'Privaten Moment andeuten', null, '🌌 {sender} und {target} verschwinden für einen sehr privaten Moment …'],
];









function contextSame(ctx, target) {
  return ctx.normalizeJid(target) === ctx.normalizeJid(ctx.sender);
}





function casinoBet(context, amount) {
  const account = user(context);
  if (!amount) return { account, error: `Nutzung: ${commandPrefix(context)}<spiel> <Betrag>` };
  if (account.bitcoin < amount) return { account, error: 'Du hast nicht genug Bitcoin.' };
  return { account };
}















function groupSettings(context) {
  context.data.groupSettings ||= {};
  context.data.groupSettings[context.jid] ||= {
    antilink: false,
    antisticker: false,
    locked: false,
    slowmode: 0,
    slowmodeUsers: {},
    warnings: {},
    mutes: {},
  };
  return context.data.groupSettings[context.jid];
}











































































function createCommandContext(values) {
  return {
    ...values,
    sendMenu: (category) => sendMenu(values, category),
    reply: (text, options = {}) => {
      const messageOptions = { ...options };
      delete messageOptions.__delayMs;
      delete messageOptions.useBanner;
      return values.sock.sendMessage(values.jid, {
        text: styledCommandReply(text, values.commandName),
        ...messageOptions,
      });
    },
  };
}

function getCommandHelp(prefix) {
  const unique = [...new Set(commands.values())];
  return `📚 Project Violette\n\n${unique.map((command) => `${prefix}${command.names[0]} - ${command.description}`).join('\n')}`;
}

const commandRuntime = {
    areJidsSameUser,
    generateWAMessageFromContent,
    proto,
    crypto,
    fs,
    path,
    MENU_IMAGE_PATH,
    BITCOIN_PER_HOUR,
    DAILY_REWARD,
    WEEKLY_REWARD,
    WORK_REWARD,
    MAX_BET,
    PRIVACY_VERSION,
    commands,
    groupOperationQueues,
    FUN_GIFS,
    register,
    mentionJids,
    targetNumber,
    user,
    displayName,
    displayUser,
    resolvePhoneNumber,
    mentionJid,
    requireRole,
    isOwner,
    isCurrentOwner,
    getStaffRank,
    requireGroup,
    commandPrefix,
    wait,
    quotedNumber,
    funTarget,
    sendFunGif,
    MENU_CATEGORIES,
    isSpicyMenuVisible,
    renderMenu,
    sendMenu,
    sendInteractiveMenu,
    COMMAND_STYLES,
    styledCommandReply,
    requireBotAdmin,
    parseAmount,
    communityJidFromMetadata,
    participantIsAdmin,
    participantMatchesJid,
    groupJidFromEntry,
    linkedCommunityGroups,
    resolveCommunityContext,
    isRateLimitError,
    participantJid,
    uniqueParticipantJids,
    withGroupOperationLock,
    runCloneUpdate,
    cloneGroup,
    spicyEnabled,
    canUseSpicy,
    isVip,
    bitcoinReward,
    registerSecretRole,
    timedRewardCommand,
    SHOP_ITEMS,
    BANKS,
    chargeBankFee,
    runFunCommand,
    CUTE_FUN_COMMANDS,
    SPICY_COMMANDS,
    contextSame,
    casinoBet,
    groupSettings,
    createCommandContext,
    getCommandHelp
  };
  const commandRegistrations = [
  ...require('./update')(commandRuntime),
  ...require('./spicy')(commandRuntime),
  ...require('./general')(commandRuntime),
  ...require('./owner')(commandRuntime),
  ...require('./team')(commandRuntime),
  ...require('./staff')(commandRuntime),
  ...require('./account')(commandRuntime),
  ...require('./economy')(commandRuntime),
  ...require('./fun')(commandRuntime),
  ...require('./casino')(commandRuntime),
  ...require('./moderation')(commandRuntime),
  ].sort((a, b) => a.order - b.order);
  for (const registration of commandRegistrations) registration.register();

module.exports = {
  commands,
  getStaffRank,
  createCommandContext,
  PRIVACY_VERSION,
  getCommandHelp,
  renderMenu,
  sendMenu,
  cloneGroup,
  communityJidFromMetadata,
  linkedCommunityGroups,
  resolveCommunityContext,
};
