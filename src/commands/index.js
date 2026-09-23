const crypto = require('crypto');
const { areJidsSameUser } = require('@whiskeysockets/baileys');

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

for (const [name, text] of [
  ['tease', 'neckt'],
  ['fantasy', 'teilt eine nicht-grafische Fantasie mit'],
]) {
  register([name], `Spicy: ${text}`, async (ctx) => {
    if (!canUseSpicy(ctx)) return;
    const target = funTarget(ctx);
    if (!target) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}${name} @Nutzer`);
    await ctx.reply(`🌙 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} ${text} ${displayName(ctx, target)} …`);
  });
}

register(['spicyrate'], 'Spicy-Inhalt bewerten', async (ctx) => {
  if (!canUseSpicy(ctx)) return;
  const value = ctx.args.join(' ').trim();
  if (!value) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}spicyrate <Text>`);
  await ctx.reply(`🔞 "${value}" erhält ${crypto.randomInt(1, 101)}/100 Spicy-Level.`);
});

function mentionJids(context) {
  const mentioned = context.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  return mentioned.length ? mentioned : [context.sender];
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
  if (role === 'mod' && context.data.mods.includes(number)) return true;
  if (role === 'support' && (context.data.mods.includes(number) || context.data.support.includes(number))) return true;
  return false;
}

function isOwner(context, number) {
  return (context.ownerNumbers || [context.ownerNumber]).includes(number);
}

function isCurrentOwner(context) {
  return isOwner(context, context.normalizeJid(context.sender));
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
    title: '👤 Account',
    commands: [
      ['register <Name>', 'Namen registrieren'],
      ['dsgvo', 'Datenschutz anzeigen'],
      ['dsgvo akzeptieren', 'Datenschutz akzeptieren'],
      ['profile', 'Account anzeigen'],
      ['bitcoin', 'Bitcoin-Guthaben anzeigen'],
      ['account', 'Account-Übersicht anzeigen'],
      ['privacy', 'Datenschutzstatus anzeigen'],
      ['deleteaccount', 'Eigene Accountdaten löschen'],
      ['usertodo add|list|done|clear', 'Persönliche Aufgaben verwalten'],
      ['me', 'Eigene Violette-Karte anzeigen'],
    ],
  },
  2: {
    title: '🎉 Fun-Befehle',
    commands: [
      ['hug @Nutzer', 'Nutzer umarmen'],
      ['kiss @Nutzer', 'Nutzer küssen'],
      ['aura [@Nutzer]', 'Aura-Level anzeigen'],
      ['howgay [@Nutzer]', 'Spielerischen Prozentwert anzeigen'],
      ['slap @Nutzer', 'Nutzer spielerisch ohrfeigen'],
      ['pat @Nutzer', 'Nutzer den Kopf tätscheln'],
      ['ship @Nutzer1 @Nutzer2', 'Zwei Nutzer shippen'],
      ['cuddle @Nutzer', 'Nutzer kuscheln'],
      ['highfive @Nutzer', 'High-Five geben'],
      ['blush @Nutzer', 'Verlegen werden'],
      ['wink @Nutzer', 'Mysteriös zuzwinkern'],
      ['comfort @Nutzer', 'Nutzer trösten'],
      ['wave @Nutzer', 'Nutzer zuwinken'],
      ['bonk @Nutzer', 'Nutzer spielerisch bonken'],
      ['flirt @Nutzer', 'Nutzer verspielt anflirten'],
      ['seb [@Nutzer]', 'Harmlosen Roast über die fiktive Bot-Rivalenfigur Seb ausgeben'],
      ['joke', 'Einen Witz erzählen'],
      ['8ball <Frage>', 'Magische 8-Ball-Antwort'],
      ['rate <Text>', 'Etwas spielerisch bewerten'],
      ['secretlover @Nutzer', 'Geheimen Lover markieren'],
      ['secretmommy @Nutzer', 'Geheime Mommy markieren'],
      ['secretdaddy @Nutzer', 'Geheimen Daddy markieren'],
    ],
  },
  3: {
    title: '💼 Economy',
    commands: [
      ['daily', 'Tägliche Bitcoin abholen'],
      ['weekly', 'Wöchentliche Bitcoin abholen'],
      ['work', 'Arbeiten und Bitcoin verdienen'],
      ['shop', 'Economy-Shop anzeigen'],
      ['buy <item>', 'Shop-Item kaufen'],
      ['inventory', 'Inventar und Vorteile anzeigen'],
      ['überweisung @Nutzer <Betrag>', 'Bitcoin überweisen'],
      ['bankkonto [Bank]', 'Bankkonto eröffnen oder anzeigen'],
      ['bankeinzahlung <Betrag>', 'Bitcoin zur Bank einzahlen'],
      ['bankauszahlung <Betrag>', 'Bitcoin von der Bank auszahlen'],
      ['banktransfer @Nutzer <Betrag>', 'Banküberweisung senden'],
      ['top', 'Bitcoin-Rangliste'],
      ['interest', 'Fällige Zinsen auszahlen'],
      ['deposit <Betrag> [Tage]', 'Bitcoin sicher anlegen'],
      ['economy', 'Economy-Übersicht anzeigen'],
    ],
  },
  4: {
    title: '🎰 Casino',
    commands: [
      ['coinflip <Betrag>', 'Kopf oder Zahl'],
      ['slots <Betrag>', 'Slotmaschine'],
      ['dice <Betrag>', 'Würfel-Casino'],
      ['roulette <rot|schwarz|grün> <Betrag>', 'Roulette spielen'],
      ['highlow <höher|niedriger> <Betrag>', 'High-Low spielen'],
      ['blackjack <Betrag>', 'Blackjack spielen'],
      ['crash <Betrag>', 'Crash-Multiplikator spielen'],
      ['baccarat <Betrag>', 'Baccarat spielen'],
      ['lottery <Betrag>', 'Lotterie spielen'],
    ],
  },
  5: {
    title: '🛡️ Group Moderation',
    commands: [
      ['kick @Nutzer', 'Nutzer entfernen'],
      ['invite <Nummer>', 'Nutzer direkt hinzufügen oder per Gruppenlink einladen'],
      ['inviteall <Nummern>', 'Mehrere ausdrücklich angegebene Nummern einladen'],
      ['warn @Nutzer [Grund]', 'Verwarnung vergeben'],
      ['warnings @Nutzer', 'Verwarnungen anzeigen'],
      ['clearwarns @Nutzer', 'Verwarnungen löschen'],
      ['mute @Nutzer <Minuten>', 'Nutzer zeitweise stummschalten'],
      ['unmute @Nutzer', 'Stummschaltung aufheben'],
      ['antilink on|off', 'Gruppenlinks automatisch entfernen'],
      ['antisticker on|off', 'Sticker automatisch entfernen'],
      ['promote @Nutzer', 'Zum Admin machen'],
      ['demote @Nutzer', 'Adminrechte entziehen'],
      ['selfpromote', 'Sich selbst zum Gruppenadmin machen'],
      ['selfdemote', 'Sich selbst zum normalen Mitglied machen'],
      ['tagall [Text]', 'Alle erwähnen'],
      ['lock on|off', 'Gruppe sperren oder öffnen'],
      ['slowmode <Sekunden>', 'Gruppen-Slowmode setzen'],
      ['clear', 'Aktuelle Nachricht löschen'],
    ],
  },
  6: {
    title: '👥 Team',
    commands: [
      ['bc <Text>', 'Broadcast senden'],
      ['bcgroup list|add|remove', 'Broadcast-Gruppen verwalten (nur Owner)'],
      ['join <Gruppenlink>', 'Join-Anfrage erstellen'],
      ['approvejoin <ID>', 'Join-Anfrage annehmen'],
      ['rejectjoin <ID>', 'Join-Anfrage ablehnen'],
      ['ignorebot add|remove', 'Bot per Antwort zur Filterliste hinzufügen/entfernen'],
      ['suggest <Idee>', 'Einen neuen Befehlsvorschlag einreichen'],
      ['suggestions', 'Offene Befehlsvorschläge anzeigen'],
      ['teamlist', 'Teammitglieder anzeigen'],
      ['modinfo [@Nutzer]', 'Moderatorinformationen anzeigen'],
      ['vip set <Tage> [@Nutzer]', 'VIP für sich oder einen Nutzer vergeben (nur Mods)'],
      ['teamhelp', 'Teamhilfe anzeigen'],
    ],
  },
  7: {
    title: '👑 Owner',
    commands: [
      ['addmod @Nutzer', 'Moderator ernennen (nur Owner)'],
      ['delmod @Nutzer', 'Moderator entfernen (nur Owner)'],
      ['addsupport @Nutzer', 'Support ernennen (nur Owner)'],
      ['delsupport @Nutzer', 'Support entfernen (nur Owner)'],
      ['prefix set <Zeichen>', 'Präfix ändern (nur Owner)'],
      ['creategroup <Name> [| <Name> ...]', 'Gruppe erstellen oder in einer Community mehrere Untergruppen anlegen (nur Owner)'],
      ['hub <Community> | <Gruppe 1> | <Gruppe 2>', 'Community mit Untergruppen erstellen (nur Owner)'],
      ['communitylink <Community-ID>', 'Aktuelle Gruppe einer Community hinzufügen (nur Owner/Admin)'],
      ['bomba', 'Alle Community-Gruppen leeren, Owner und Bot behalten (nur Owner)'],
      ['clone <Name>', 'Aktuelle Gruppe mit denselben Mitgliedern kopieren (nur Owner/Admin)'],
      ['promoteall', 'Alle Gruppenmitglieder zu Admins machen (nur Owner/Admin)'],
      ['ca [@Nutzer]', 'Zielmitglied in passenden Community-Untergruppen zum Admin machen (nur Owner)'],
      ['nuke', 'Gruppe in „NukeIncoming“ umbenennen und leeren (nur Owner/Admin)'],
      ['groupignore on|off|status', 'Bot in einer Gruppe steuern (nur Owner)'],
      ['tempban @Nutzer <Minuten>', 'Temporär sperren (nur Owner)'],
      ['ban @Nutzer', 'Unbefristet sperren (nur Owner)'],
      ['unban @Nutzer', 'Sperre aufheben (nur Owner)'],
      ['block <Nummer>', 'Privatchat und private Befehle blockieren (nur Owner)'],
      ['unblock <Nummer>', 'Privatchat wieder freigeben (nur Owner)'],
      ['give @Nutzer <Betrag>', 'Bitcoin vergeben (nur Owner)'],
      ['welcome @Nutzer <Name>', 'Account direkt einrichten (nur Owner)'],
      ['botstats', 'Bot-Statistiken anzeigen'],
      ['reload', 'Botdaten neu laden'],
      ['maintenance on|off|status', 'Wartungsmodus (nur Owner)'],
      ['mt add|list|remove <command>', 'Befehle in Wartung setzen und verwalten (nur Owner)'],
      ['suggestion <ID> yes|no', 'Befehlsvorschlag annehmen oder ablehnen (nur Owner)'],
      ['alias add|remove|list', 'Eigene Kurzbefehle verwalten (nur Owner)'],
    ],
  },
  8: {
    title: '🌌 Spicy-Modus',
    commands: [
      ['adult yes', '18+-Nutzung für dich bestätigen'],
      ['adult no', '18+-Bestätigung zurücknehmen'],
      ['spicy on', 'Spicy in dieser Gruppe aktivieren (Owner/Mods)'],
      ['spicy off', 'Spicy in dieser Gruppe deaktivieren (Owner/Mods)'],
      ['spicy status', 'Status des Spicy-Modus anzeigen'],
      ['seduce @Nutzer', 'Nicht-grafisch verführen'],
      ['makeout @Nutzer', 'Intensiven Kuss andeuten'],
      ['private @Nutzer', 'Privaten Moment andeuten'],
      ['fuck @Nutzer', 'Diskrete 18+-Andeutung'],
      ['tease @Nutzer', 'Nicht-grafisch necken'],
      ['fantasy @Nutzer', 'Nicht-grafische Fantasie teilen'],
      ['spicyrate <Text>', 'Spicy-Inhalt bewerten'],
    ],
  },
};

function isSpicyMenuVisible(context) {
  return Boolean(context?.data?.spicyGroups?.[context.jid]);
}

function renderMenu(category, prefix = '#', context) {
  const menuStyle = {
    1: ['╭━━━ 🌷 ACCOUNT GARDEN ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━╯', '🌷'],
    2: ['╭━━━ 💞 FUN BOULEVARD ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━╯', '💞'],
    3: ['╭━━━ 💎 ECONOMY PALACE ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━━╯', '💎'],
    4: ['╭━━━ 🎰 NEON CASINO ━━━╮', '╰━━━━━━━━━━━━━━━━━━━╯', '🎰'],
    5: ['╭━━━ 🛡️ VIOLETTE GUARD ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━━╯', '🛡️'],
    6: ['╭━━━ 👥 INNER CIRCLE ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━╯', '👥'],
    7: ['╭━━━ 👑 ROYAL CONTROL ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━━╯', '👑'],
    8: ['╭━━━ 🌌 MOONLIGHT MODE ━━━╮', '╰━━━━━━━━━━━━━━━━━━━━━━━━╯', '🌌'],
  };
  if (!category) {
    const visibleCategories = Object.entries(MENU_CATEGORIES)
      .filter(([number]) => (number !== '7' || isCurrentOwner(context))
        && (number !== '8' || isSpicyMenuVisible(context)));
    return `╭━━━ 🌸 VIOLETTE NEXUS 🌸 ━━━╮\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${Object.entries(MENU_CATEGORIES)
      .filter(([number]) => (number !== '7' || isCurrentOwner(context))
        && (number !== '8' || isSpicyMenuVisible(context)))
      .map(([number, menu]) => `┃ ${prefix}menu${number}  ✦  ${menu.title}`)
      .join('\n')}\n\n✦ Verfügbare Kategorien: ${visibleCategories.map(([number]) => `${prefix}menu${number}`).join(', ')}\n✦ ${prefix}commands zeigt alle registrierten Befehle`;
  }
  const menu = MENU_CATEGORIES[category];
  if (!menu
    || (category === '7' && !isCurrentOwner(context))
    || (category === '8' && !isSpicyMenuVisible(context))) {
    return `Dieses Menü gibt es nicht. Nutze ${prefix}menu für die Übersicht.`;
  }
  const [top, bottom, icon] = menuStyle[category] || [`╭━━━ ${menu.title} ━━━╮`, '╰━━━━━━━━━━━━━━━━╯', '✦'];
  return `${top}\n${bottom}\n\n${menu.commands
    .map(([command, description]) => `✦ ${prefix}${command}\n  └─ ${description}`)
    .join('\n\n')}\n\n${icon} ${menu.title} • ${prefix}menu für Übersicht`;
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

function linkedCommunityGroups(result) {
  const groups = result?.linkedGroups || result?.groups || result?.linked || [];
  return Array.isArray(groups) ? groups.filter((group) => group?.id) : [];
}

async function resolveCommunityContext(context) {
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

register(['ping'], 'Verbindung und Antwortzeit prüfen', async (ctx) => {
  await ctx.reply(`Pong! 🏓\n${ctx.responseDelayMs} ms`);
});
register(['help', 'menu'], 'Kategorien-Menü anzeigen', async (ctx) => (
  ctx.reply(renderMenu(undefined, commandPrefix(ctx), ctx), { useBanner: true })
));
register(['commands'], 'Alle registrierten Befehle anzeigen', async (ctx) => {
  const prefix = commandPrefix(ctx);
  const unique = [...new Set([...commands.values()])];
  await ctx.reply(`📚 REGISTRIERTE BEFEHLE\n\n${unique
    .map((command) => `${prefix}${command.names[0]} — ${command.description}`)
    .join('\n')}`);
});
register(['prefix'], 'Präfix ändern (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf den Präfix ändern.');
  const action = (ctx.args[0] || '').toLowerCase();
  const requested = action === 'set' ? ctx.args[1] : ctx.args[0];
  if (!requested || requested.length > 3 || /\s/.test(requested) || /[a-z0-9]/i.test(requested)) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}prefix set <Zeichen>\nBeispiel: ${commandPrefix(ctx)}prefix set !`);
  }
  ctx.data.settings ||= {};
  ctx.data.settings.prefix = requested;
  ctx.saveData();
  await ctx.reply(`✅ Neuer Präfix: ${requested}\n\n${renderMenu(undefined, requested, ctx)}`);
});
register(['creategroup', 'mkgroup'], 'Neue WhatsApp-Gruppe erstellen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Gruppen erstellen.');
  const names = ctx.args.join(' ').split('|').map((name) => name.trim()).filter(Boolean);
  const subject = names[0];
  if (!subject) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}creategroup <Name> [| <Name> ...]`);

  if (typeof ctx.sock.communityMetadata === 'function') {
    let community = null;
    try {
      community = await ctx.sock.communityMetadata(ctx.jid);
    } catch {
      community = null;
    }
    const communityJid = community?.isCommunity
      ? ctx.jid
      : community?.linkedParent;
    if (communityJid && typeof ctx.sock.communityCreateGroup === 'function') {
      const ownerJid = `${ctx.ownerNumber}@s.whatsapp.net`;
      const created = [];
      const failed = [];
      for (const groupName of names) {
        try {
          const group = await ctx.sock.communityCreateGroup(groupName, [ownerJid], communityJid);
          if (group?.id) created.push(`${groupName} (${group.id})`);
          else failed.push(`${groupName} (keine ID)`);
        } catch (error) {
          console.error(`❌ Community-Untergruppe "${groupName}":`, error);
          failed.push(`${groupName} (fehlgeschlagen)`);
        }
        if (groupName !== names[names.length - 1]) await wait(10000);
      }
      return ctx.reply(`✅ Community-Untergruppen verarbeitet.\n\n${
        created.length ? `Erstellt:\n${created.map((entry) => `• ${entry}`).join('\n')}` : 'Keine Gruppe erstellt.'
      }${
        failed.length ? `\n\n⚠️ Fehlgeschlagen:\n${failed.map((entry) => `• ${entry}`).join('\n')}` : ''
      }`);
    }
  }

  if (names.length > 1) return ctx.reply('Mehrere Namen funktionieren nur innerhalb einer WhatsApp-Community. Nutze den Befehl dort.');
  const ownerJid = `${ctx.ownerNumber}@s.whatsapp.net`;
  const group = await ctx.sock.groupCreate(subject, [ownerJid]);
  await ctx.sock.sendMessage(group.id, {
    text: `🌸 Diese Gruppe wurde von Project Violette erstellt.\nName: ${subject}`,
  });
  await ctx.reply(`✅ Gruppe erstellt: ${subject}\n${group.id}`);
});
register(['hub'], 'Neue Community mit Untergruppen erstellen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Communities erstellen.');
  if (typeof ctx.sock.communityCreate !== 'function' || typeof ctx.sock.communityCreateGroup !== 'function') {
    return ctx.reply('Diese Baileys-Version unterstützt keine Community-Erstellung.');
  }
  const names = ctx.args.join(' ').split('|').map((name) => name.trim()).filter(Boolean);
  const subject = names.shift();
  if (!subject) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}hub <Community> | <Gruppe 1> | <Gruppe 2>`);
  const community = await ctx.sock.communityCreate(subject, `Community ${subject}`);
  if (!community?.id) return ctx.reply('Die Community konnte nicht erstellt werden.');
  const ownerJid = `${ctx.ownerNumber}@s.whatsapp.net`;
  const createdGroups = [];
  const failedGroups = [];
  for (const groupName of names) {
    try {
      const group = await ctx.sock.communityCreateGroup(groupName, [ownerJid], community.id);
      if (group?.id) createdGroups.push(`${groupName} (${group.id})`);
      else failedGroups.push(`${groupName} (keine ID)`);
    } catch (error) {
      const isRateLimited = error?.data === 429
        || error?.output?.statusCode === 429
        || error?.message === 'rate-overlimit';
      console.error(`❌ Untergruppe "${groupName}" konnte nicht erstellt werden:`, error);
      failedGroups.push(`${groupName} (${isRateLimited ? 'WhatsApp-Limit erreicht' : 'Fehler'})`);
      if (isRateLimited) break;
    }
    await wait(5000);
  }
  await ctx.reply(`✅ Hub erstellt: ${subject}\nID: ${community.id}\n\n${
    createdGroups.length
      ? `Untergruppen:\n${createdGroups.map((group) => `• ${group}`).join('\n')}`
      : 'Keine Untergruppen angegeben.'
  }${
    failedGroups.length
      ? `\n\n⚠️ Nicht erstellt:\n${failedGroups.map((group) => `• ${group}`).join('\n')}\nBitte vor weiteren Untergruppen einige Minuten warten.`
      : ''
  }`);
});
register(['communitylink', 'clink'], 'Aktuelle Gruppe einer Community hinzufügen (Owner/Admin)', async (ctx) => {
  if (!requireRole(ctx, 'owner') || !(await requireBotAdmin(ctx))) return;
  if (typeof ctx.sock.communityLinkGroup !== 'function') {
    return ctx.reply('Diese Baileys-Version unterstützt keine Community-Verknüpfung.');
  }
  const communityJid = ctx.args[0];
  if (!communityJid || !communityJid.endsWith('@g.us')) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}communitylink <Community-ID>`);
  }
  await ctx.sock.communityLinkGroup(ctx.jid, communityJid);
  await ctx.reply(`✅ Diese Gruppe wurde der Community ${communityJid} hinzugefügt.`);
});
register(['bomba'], 'Alle Community-Gruppen leeren (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Bomba ausf?hren.');
  if (typeof ctx.sock.communityMetadata !== 'function'
    || typeof ctx.sock.communityFetchLinkedGroups !== 'function') {
    return ctx.reply('Diese Baileys-Version unterst?tzt keine Community-Verwaltung.');
  }

  let currentMetadata;
  try {
    currentMetadata = await ctx.sock.communityMetadata(ctx.jid);
  } catch (error) {
    console.error('? Bomba: Community-Metadaten konnten nicht geladen werden:', error);
    return ctx.reply('Bomba funktioniert nur in einer Community oder deren Untergruppe.');
  }
  const communityJid = currentMetadata?.isCommunity ? ctx.jid : currentMetadata?.linkedParent;
  if (!communityJid) return ctx.reply('Bomba funktioniert nur in einer Community oder deren Untergruppe.');

  const linked = await ctx.sock.communityFetchLinkedGroups(communityJid);
  const botIds = [ctx.sock.user?.id, ctx.sock.user?.lid, ctx.sock.user?.phoneNumber].filter(Boolean);
  const protectedJids = [ctx.sender, ctx.message?.key?.participantAlt, ...botIds].filter(Boolean);
  const sameProtectedUser = (participant) => protectedJids.some((jid) => (
    [participant.id, participant.lid, participant.phoneNumber].some((candidate) => (
      candidate && (
        areJidsSameUser(candidate, jid)
        || ctx.normalizeJid(candidate) === ctx.normalizeJid(jid)
      )
    ))
  ));
  const results = [];

  for (const linkedGroup of linked.linkedGroups || []) {
    if (!linkedGroup.id) continue;
    try {
      const metadata = await ctx.sock.groupMetadata(linkedGroup.id);
      const bot = metadata.participants.find((participant) => sameProtectedUser({
        id: participant.id,
        lid: participant.lid,
        phoneNumber: participant.phoneNumber,
      }) && botIds.some((jid) => (
        [participant.id, participant.lid, participant.phoneNumber].some((candidate) => (
          candidate && (areJidsSameUser(candidate, jid)
            || ctx.normalizeJid(candidate) === ctx.normalizeJid(jid))
        ))
      )));
      const botIsAdmin = bot && (
        ['admin', 'superadmin'].includes(bot.admin) || bot.isAdmin || bot.isSuperAdmin
      );
      if (!botIsAdmin) {
        results.push(`? ${metadata.subject}: Bot ist kein Admin`);
        continue;
      }
      const membersToRemove = metadata.participants
        .filter((participant) => !sameProtectedUser(participant))
        .map((participant) => participant.id);
      if (membersToRemove.length) {
        await ctx.sock.groupParticipantsUpdate(linkedGroup.id, membersToRemove, 'remove');
      }
      results.push(`? ${metadata.subject}: ${membersToRemove.length} Mitglieder entfernt`);
    } catch (error) {
      console.error(`? Bomba f?r ${linkedGroup.id}:`, error);
      results.push(`? ${linkedGroup.subject || linkedGroup.id}: fehlgeschlagen`);
    }
    await wait(5000);
  }
  await ctx.reply(`?? BOMBA abgeschlossen
Community: ${communityJid}

${
    results.length ? results.join('\n') : 'Keine verkn?pften Gruppen gefunden.'
  }`);
});
register(['ca'], 'Zielmitglied in passenden Community-Untergruppen zum Admin machen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Community-Admins setzen.');
  if (!requireGroup(ctx)) return;
  if (typeof ctx.sock.communityFetchLinkedGroups !== 'function') {
    return ctx.reply('Diese Baileys-Version unterst?tzt keine Community-Verwaltung.');
  }

  let community;
  try {
    community = await resolveCommunityContext(ctx);
  } catch (error) {
    console.error('? CA: Community-Zuordnung konnte nicht geladen werden:', error);
  }
  if (!community) return ctx.reply('CA funktioniert nur in einer Community oder deren verkn?pfter Untergruppe.');

  const targetNumber = quotedNumber(ctx);
  if (!targetNumber) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}ca [@Nutzer] oder als Antwort auf eine Nachricht.`);
  const targetJid = mentionJid(ctx, targetNumber);
  const { communityJid, groups } = community;
  let promoted = 0;
  let alreadyAdmin = 0;
  let skipped = 0;
  let failed = 0;
  for (const [index, linkedGroup] of groups.entries()) {
    try {
      const metadata = await ctx.sock.groupMetadata(linkedGroup.id);
      const executor = metadata.participants.find((participant) => (
        participantMatchesJid(ctx, participant, ctx.sender)
      ));
      const botIds = [ctx.sock.user?.id, ctx.sock.user?.lid, ctx.sock.user?.phoneNumber].filter(Boolean);
      const bot = metadata.participants.find((participant) => (
        botIds.some((botId) => participantMatchesJid(ctx, participant, botId))
      ));
      if (!participantIsAdmin(executor) || !participantIsAdmin(bot)) {
        skipped += 1;
      } else {
        const target = metadata.participants.find((participant) => (
          participantMatchesJid(ctx, participant, targetJid)
        ));
        if (!target) {
          skipped += 1;
        } else if (participantIsAdmin(target)) {
          alreadyAdmin += 1;
        } else {
          await ctx.sock.groupParticipantsUpdate(linkedGroup.id, [target.id || targetJid], 'promote');
          promoted += 1;
        }
      }
    } catch (error) {
      console.error(`? CA: Untergruppe ${index + 1} konnte nicht verarbeitet werden:`, error);
      failed += 1;
    }
    if (index < groups.length - 1) await wait(5000);
  }

  await ctx.reply(`? Community-Admin abgeschlossen.
Untergruppen gepr?ft: ${groups.length}
Bef?rdert: ${promoted}
Bereits Admin: ${alreadyAdmin}
?bersprungen: ${skipped}
Fehlgeschlagen: ${failed}`);
});
register(['clone'], 'Aktuelle Gruppe mit denselben Mitgliedern kopieren (nur Owner/Admin)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Gruppen klonen.');
  const subject = ctx.args.join(' ').trim();
  if (!subject) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}clone <Name>`);

  const report = await cloneGroup(ctx, subject);
  if (report) await ctx.reply(report.summary);
});
register(['promoteall'], 'Alle Gruppenmitglieder zu Admins machen (nur Owner/Admin)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf alle Mitglieder zu Admins machen.');
  const metadata = await requireBotAdmin(ctx);
  if (!metadata) return;
  const targets = metadata.participants
    .filter((participant) => !['admin', 'superadmin'].includes(participant.admin)
      && !participant.isAdmin && !participant.isSuperAdmin)
    .map((participant) => participant.id);
  if (targets.length) await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, 'promote');
  await ctx.reply(`✅ ${targets.length ? `${targets.length} Mitglied(er) wurden` : 'Alle Mitglieder sind bereits'} Admins.`);
});
register(['nuke'], 'Rename and clear the group (owner/admin only)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Only the owner can nuke a group.');
  if (!requireGroup(ctx)) return;

  const metadata = await ctx.sock.groupMetadata(ctx.jid);
  const ownerNumber = ctx.normalizeJid(ctx.sender);
  const senderJids = [
    ctx.sender,
    ctx.message?.key?.participantAlt,
  ].filter(Boolean);
  const sameJid = (left, right) => Boolean(left && right && areJidsSameUser(left, right));
  const isSameOwner = (participant) => senderJids.some((jid) => (
    sameJid(participant.id, jid)
    || sameJid(participant.lid, jid)
    || sameJid(participant.phoneNumber, jid)
    || ctx.normalizeJid(participant.id) === ctx.normalizeJid(jid)
    || ctx.normalizeJid(participant.lid) === ctx.normalizeJid(jid)
    || ctx.normalizeJid(participant.phoneNumber) === ctx.normalizeJid(jid)
  ));
  const owner = metadata.participants.find((participant) => (
    isSameOwner(participant)
    || ctx.normalizeJid(participant.id) === ownerNumber
    || ctx.normalizeJid(participant.lid) === ownerNumber
    || ctx.normalizeJid(participant.phoneNumber) === ownerNumber
  ));
  const isAdmin = (participant) => Boolean(
    participant && (
      ['admin', 'superadmin'].includes(participant.admin)
      || participant.isAdmin
      || participant.isSuperAdmin
    )
  );
  if (!isAdmin(owner)) {
    return ctx.reply('You must be a group admin to nuke this group.');
  }

  const botIds = [ctx.sock.user?.id, ctx.sock.user?.lid].filter(Boolean);
  const isSameBot = (participant) => botIds.some((botId) => (
    participant.id === botId
    || participant.lid === botId
    || participant.phoneNumber === botId
    || sameJid(participant.id, botId)
    || sameJid(participant.lid, botId)
    || sameJid(participant.phoneNumber, botId)
    || sameJid(participant.id, ctx.sock.user?.phoneNumber)
    || sameJid(participant.lid, ctx.sock.user?.phoneNumber)
    || sameJid(participant.phoneNumber, ctx.sock.user?.phoneNumber)
    || ctx.normalizeJid(participant.phoneNumber) === ctx.normalizeJid(botId)
  ));
  const bot = metadata.participants.find(isSameBot);
  if (!isAdmin(bot)) {
    return ctx.reply('I must be a group admin to nuke this group.');
  }

  const ownerJid = owner.id;
  const adminsToDemote = metadata.participants
    .filter((participant) => isAdmin(participant)
      && !areJidsSameUser(participant.id, ownerJid)
      && !isSameBot(participant))
    .map((participant) => participant.id);
  const membersToRemove = metadata.participants
    .filter((participant) => !areJidsSameUser(participant.id, ownerJid)
      && !isSameBot(participant))
    .map((participant) => participant.id);

  await ctx.sock.groupUpdateSubject(ctx.jid, 'NukeIncoming');
  await ctx.sock.groupUpdateDescription(ctx.jid, 'Nuked by 7');
  if (adminsToDemote.length) {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, adminsToDemote, 'demote');
  }
  await ctx.sock.sendMessage(ctx.jid, { text: '☢️ NukeIncoming\nNuked by 7\nAll members have been removed except the owner and bot.' });
  if (membersToRemove.length) {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, membersToRemove, 'remove');
  }
  await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement');
});
register(['ignorebot'], 'Einen Bot per Antwort filtern (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen den Bot-Filter ändern.');
  const value = (ctx.args[0] || '').toLowerCase();
  if (!['add', 'remove', 'list'].includes(value)) {
    return ctx.reply(`Erwähne einen Bot oder antworte auf seine Nachricht und nutze:\n${commandPrefix(ctx)}ignorebot add\n${commandPrefix(ctx)}ignorebot remove\n${commandPrefix(ctx)}ignorebot list`);
  }
  ctx.data.ignoredBots ||= [];
  if (value === 'list') {
    return ctx.reply(ctx.data.ignoredBots.length
      ? `🤖 Gefilterte Bots:\n${ctx.data.ignoredBots.map((number) => `• ${displayUser(ctx, number)}`).join('\n')}`
      : '🤖 Die Bot-Filterliste ist leer.');
  }
  const number = quotedNumber(ctx);
  if (!number) return ctx.reply(`Bitte erwähne den Bot oder antworte direkt auf seine Nachricht und nutze danach ${commandPrefix(ctx)}ignorebot ${value}.`);
  if (value === 'add' && !ctx.data.ignoredBots.includes(number)) ctx.data.ignoredBots.push(number);
  if (value === 'remove') ctx.data.ignoredBots = ctx.data.ignoredBots.filter((entry) => entry !== number);
  ctx.saveData();
  await ctx.reply(`✅ Bot ${displayUser(ctx, number)} wurde ${value === 'add' ? 'zur Filterliste hinzugefügt' : 'von der Filterliste entfernt'}.`);
});
register(['groupignore', 'gi'], 'Bot in einer Gruppe aus- oder einschalten (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf den Bot für eine Gruppe abschalten.');
  if (!requireGroup(ctx)) return;
  ctx.data.groupIgnore ||= {};
  const action = (ctx.args[0] || 'status').toLowerCase();
  if (action === 'status') {
    return ctx.reply(`🔕 Gruppenmodus: ${ctx.data.groupIgnore[ctx.jid] ? 'Bot ist ausgeschaltet' : 'Bot ist aktiv'}`);
  }
  if (!['on', 'off'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}groupignore on|off|status`);
  ctx.data.groupIgnore[ctx.jid] = action === 'on';
  ctx.saveData();
  await ctx.reply(action === 'on'
    ? '🔕 Bot in dieser Gruppe ausgeschaltet. Nur der Owner kann ihn mit #groupignore off wieder aktivieren.'
    : '✅ Bot in dieser Gruppe wieder aktiviert.');
});
for (const [number, menu] of Object.entries(MENU_CATEGORIES)) {
  register([`menu${number}`], `${menu.title} anzeigen`, async (ctx) => {
    if (number === '7' && !isCurrentOwner(ctx)) {
      return ctx.reply('🔒 Dieses Owner-Menü ist ausschließlich für den Owner sichtbar.');
    }
    if (number === '8' && !isSpicyMenuVisible(ctx)) {
      return ctx.reply(`Dieses Menü ist nicht aktiviert. Ein Owner oder Mod muss zuerst ${commandPrefix(ctx)}spicy on nutzen.`);
    }
    return ctx.reply(renderMenu(number, commandPrefix(ctx), ctx));
  });
}
register(['say'], 'Text wiederholen', async (ctx) => ctx.reply(ctx.args.join(' ') || 'Nutzung: #say <Text>'));

register(['register'], 'Namen für die Bot-Nutzung registrieren', async (ctx) => {
  if (ctx.isGroup) return ctx.reply(`🔒 Registrierung ist nur im Privatchat möglich. Nutze dort ${commandPrefix(ctx)}register <Name>.`);
  if (!user(ctx).privacyAccepted) {
    return ctx.reply(`🔒 Aktiviere zuerst die Nutzungsbedingungen mit ${commandPrefix(ctx)}dsgvo akzeptieren.`);
  }
  const name = ctx.args.join(' ').trim();
  if (!name || name.length < 2 || name.length > 40) {
    return ctx.reply('Nutzung: #register <Name> (2 bis 40 Zeichen)');
  }
  const account = user(ctx);
  account.displayName = name;
  ctx.saveData();
  await ctx.reply(`✅ Danke, ${name}. Dein Account ist registriert.`);
});

register(['welcome'], 'Account für einen Nutzer direkt einrichten (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Accounts direkt einrichten.');
  const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const target = mentioned[0] ? ctx.normalizeJid(mentioned[0]) : '';
  const name = ctx.args.slice(1).join(' ').trim();
  if (!target || !name || name.length < 2 || name.length > 40) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}welcome @Nutzer <Name>`);
  }
  const account = user(ctx, target);
  account.displayName = name;
  account.privacyAccepted = true;
  account.privacyAcceptedAt ||= new Date().toISOString();
  ctx.saveData();
  await ctx.reply(`✅ Account für ${displayUser(ctx, target)} wurde als „${name}“ eingerichtet.`);
});

register(['vip'], 'VIP für sich oder einen Nutzer vergeben (nur Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Mods und der Owner dürfen VIP vergeben.');
  if ((ctx.args[0] || '').toLowerCase() !== 'set') {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}vip set <Tage> [@Nutzer] oder als Antwort auf eine Nachricht.`);
  }
  const days = Number(ctx.args[1]);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return ctx.reply(`Die VIP-Dauer muss zwischen 1 und 365 Tagen liegen.\nNutzung: ${commandPrefix(ctx)}vip set <Tage> [@Nutzer]`);
  }
  const mentioned = ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const quotedParticipant = ctx.message.message?.extendedTextMessage?.contextInfo?.participant;
  const target = ctx.normalizeJid(mentioned[0] || quotedParticipant || ctx.sender);
  if (!target) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}vip set <Tage> [@Nutzer] oder als Antwort auf eine Nachricht.`);
  }
  const account = user(ctx, target);
  const duration = days * 24 * 3600000;
  account.vipUntil = Math.max(account.vipUntil || 0, Date.now()) + duration;
  account.rank = 'vip';
  account.inventory = [...new Set(account.inventory.concat('vip'))];
  ctx.saveData();
  await ctx.reply(`⭐ VIP wurde für ${displayUser(ctx, target)} für ${days} Tage aktiviert.`, {
    mentions: [mentionJid(ctx, target)],
  });
});

register(['dsgvo'], 'Datenschutzinformationen anzeigen und akzeptieren', async (ctx) => {
  if (ctx.isGroup) return ctx.reply(`🔒 Aktiviere die Nutzungsbedingungen zuerst im Privatchat mit ${commandPrefix(ctx)}dsgvo akzeptieren.`);
  const account = user(ctx);
  if (ctx.args[0]?.toLowerCase() !== 'akzeptieren') {
    await ctx.reply(
      '🔐 Datenschutzinformationen\n\n' +
      'Der Bot speichert nur deine WhatsApp-ID, deinen angegebenen Namen, dein internes Bitcoin-Guthaben, ' +
      'Zeitpunkte für Economy-Befehle, Rollen und offene Join-Anfragen. Diese Daten werden lokal in ' +
      'data/bot-data.json gespeichert und für Bot-Funktionen verwendet. Es werden keine Daten ' +
      'an externe Dienste übertragen. Du kannst die Löschung deiner Daten beim Owner anfordern.\n\n' +
      'Wenn du einverstanden bist, nutze: #dsgvo akzeptieren',
    );
    return;
  }
  account.privacyAccepted = true;
  account.privacyAcceptedAt = new Date().toISOString();
  ctx.saveData();
  await ctx.reply('✅ Datenschutz akzeptiert. Du kannst den Bot jetzt nutzen.');
});

register(['adult'], '18+-Bestätigung verwalten', async (ctx) => {
  const value = (ctx.args[0] || '').toLowerCase();
  const account = user(ctx);
  if (!['yes', 'no', 'status'].includes(value)) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}adult yes|no|status\nBestätige nur, wenn du volljährig bist.`);
  }
  if (value === 'status') {
    return ctx.reply(account.adultConfirmed
      ? '🔞 Deine 18+-Bestätigung ist aktiv.'
      : '🔒 Deine 18+-Bestätigung ist nicht aktiv.');
  }
  account.adultConfirmed = value === 'yes';
  account.adultConfirmedAt = account.adultConfirmed ? new Date().toISOString() : null;
  ctx.saveData();
  await ctx.reply(account.adultConfirmed
    ? '✅ 18+-Bestätigung gespeichert. Spicy-Befehle sind für dich freigeschaltet.'
    : '✅ 18+-Bestätigung entfernt. Spicy-Befehle sind für dich gesperrt.');
});

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

register(['spicy'], 'Spicy-Modus verwalten', async (ctx) => {
  const action = (ctx.args[0] || 'status').toLowerCase();
  ctx.data.spicyGroups ||= {};
  if (action === 'status') {
    return ctx.reply(ctx.isGroup
      ? `🌌 Spicy-Modus in dieser Gruppe: ${spicyEnabled(ctx) ? 'AKTIV' : 'AUS'}`
      : '🌌 Spicy-Befehle sind im Privatchat verfügbar, wenn du #adult yes bestätigt hast.');
  }
  if (!ctx.isGroup) return ctx.reply('🌌 In Privatchats ist Spicy nicht separat schaltbar. Nutze #adult yes oder #adult no.');
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Spicy in Gruppen ändern.');
  if (!['on', 'off'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}spicy on|off|status`);
  ctx.data.spicyGroups[ctx.jid] = action === 'on';
  ctx.saveData();
  await ctx.reply(`✅ Spicy-Modus ist in dieser Gruppe jetzt ${action === 'on' ? 'aktiviert' : 'deaktiviert'}.`);
});

register(['tempban'], 'Nutzer zeitweise sperren (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Nutzer bannen.');
  const number = targetNumber(ctx, ctx.args[0]);
  const minutes = Number(ctx.args.find((arg) => /^\d+$/.test(arg)));
  if (!number || !Number.isInteger(minutes) || minutes < 1 || minutes > 525600) {
    return ctx.reply('Nutzung: #tempban @Nutzer <Minuten> (max. 365 Tage)');
  }
  if (isOwner(ctx, number)) return ctx.reply('Du kannst keinen Owner bannen.');
  ctx.data.bans[number] = { until: Date.now() + minutes * 60000, permanent: false, by: ctx.ownerNumber };
  ctx.saveData();
  await ctx.reply(`✅ Nutzer ${displayUser(ctx, number)} für ${minutes} Minuten gesperrt.`);
});

register(['ban'], 'Nutzer dauerhaft sperren (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Nutzer bannen.');
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply('Nutzung: #ban @Nutzer oder #ban <Nummer>');
  if (isOwner(ctx, number)) return ctx.reply('Du kannst keinen Owner bannen.');
  ctx.data.bans[number] = { permanent: true, by: ctx.ownerNumber };
  ctx.saveData();
  await ctx.reply(`✅ Nutzer ${displayUser(ctx, number)} dauerhaft gesperrt.`);
});

register(['unban'], 'Nutzer-Bann aufheben (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Banns aufheben.');
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply('Nutzung: #unban @Nutzer oder #unban <Nummer>');
  delete ctx.data.bans[number];
  ctx.saveData();
  await ctx.reply(`✅ Bann für ${displayUser(ctx, number)} aufgehoben.`);
});

register(['block'], 'Private Nachrichten/Befehle blockieren (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Privatchats blockieren.');
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number || isOwner(ctx, number)) return ctx.reply('Nutzung: #block <Nummer> oder #block @Nutzer');
  const jid = `${number}@s.whatsapp.net`;
  if (!ctx.data.blockedPrivateChats.includes(number)) ctx.data.blockedPrivateChats.push(number);
  ctx.saveData();
  await ctx.sock.updateBlockStatus(jid, 'block');
  await ctx.reply(`✅ Privatchat mit ${displayUser(ctx, number)} blockiert. Private Nachrichten und Befehle werden ignoriert; Gruppen bleiben unberührt.`);
});

register(['unblock'], 'Privatchat entsperren (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Privatchats entsperren.');
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply('Nutzung: #unblock <Nummer> oder #unblock @Nutzer');
  ctx.data.blockedPrivateChats = ctx.data.blockedPrivateChats.filter((entry) => entry !== number);
  ctx.saveData();
  await ctx.sock.updateBlockStatus(`${number}@s.whatsapp.net`, 'unblock');
  await ctx.reply(`✅ Privatchat mit ${displayUser(ctx, number)} entsperrt.`);
});

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

register(['profile'], 'Account anzeigen', async (ctx) => {
  const account = user(ctx);
  await ctx.reply(`👤 ${account.displayName || 'Unregistriert'}\n₿ Bitcoin: ${account.bitcoin}\n⭐ VIP: ${isVip(account) ? 'aktiv' : 'inaktiv'}`);
});

register(['account'], 'Account-Übersicht anzeigen', async (ctx) => {
  const account = user(ctx);
  await ctx.reply(`👤 ${account.displayName || 'Unregistriert'}\n🆔 ${displayUser(ctx, ctx.sender)}\n₿ Wallet: ${account.bitcoin} Bitcoin\n🏦 Bank: ${account.bankAccount ? `${account.bankAccount.balance} Bitcoin` : 'kein Konto'}\n🔞 18+: ${account.adultConfirmed ? 'aktiv' : 'inaktiv'}`);
});

register(['privacy'], 'Datenschutzstatus anzeigen', async (ctx) => {
  const account = user(ctx);
  await ctx.reply(`🔐 Datenschutz: ${account.privacyAccepted ? 'akzeptiert' : 'nicht akzeptiert'}\nGespeichert werden nur Bot-Daten lokal. Löschen mit ${commandPrefix(ctx)}deleteaccount.`);
});

register(['deleteaccount'], 'Eigene Accountdaten löschen', async (ctx) => {
  const id = ctx.normalizeJid(ctx.sender);
  if (!ctx.data.users[id]) return ctx.reply('Für dich sind keine Accountdaten gespeichert.');
  delete ctx.data.users[id];
  ctx.saveData();
  await ctx.reply('✅ Deine eigenen Accountdaten wurden gelöscht. Für eine erneute Nutzung musst du dich neu registrieren.');
});

register(['me'], 'Eigene Violette-Karte anzeigen', async (ctx) => {
  const account = user(ctx);
  const hasMagnifier = account.inventory.includes('lupe');
  const badgeLine = (item, label, icon) => account.inventory.includes(item) ? `│ ${icon} ${label}\n` : '';
  const secretLine = (label, number) => hasMagnifier && number
    ? `${label}: ${displayName(ctx, number)}`
    : `${label}: 🔒 verborgen${hasMagnifier ? '' : ' — kaufe eine Lupe im Shop'}`;
  const badges = [
    badgeLine('crown', 'Violette Royal', '👑'),
    badgeLine('rose', 'Rose Aura', '🌹'),
    badgeLine('glow', 'Neon Glow', '✨'),
    badgeLine('signature', 'Signature Drop', '💎'),
  ].filter(Boolean).join('');
  const rankLabels = {
    standard: 'Standard',
    'vip-daily': 'VIP Daily',
    vip: 'VIP',
    'vip-premium': 'VIP Premium',
    elite: 'Elite',
  };
  const activeRank = isVip(account) ? account.rank : 'standard';
  await ctx.reply(`╭━━━ 💜 YOUR VIOLETTE CARD ━━━╮\n`
    + `│ Name: ${account.displayName || 'Unregistriert'}\n`
    + `│ Rang: ${rankLabels[activeRank] || rankLabels.standard}\n`
    + `│ Bitcoin: ${account.bitcoin}\n`
    + `│ ${secretLine('Secret Lover', account.secretLover)}\n`
    + `│ ${secretLine('Secret Mommy', account.secretMommy)}\n`
    + `│ ${secretLine('Secret Daddy', account.secretDaddy)}\n`
    + (badges || '│ Styles: 🔒 keine gekauft\n')
    + `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`);
});

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

registerSecretRole('secretlover', 'secretLover', 'Secret Lover');
registerSecretRole('secretmommy', 'secretMommy', 'Secret Mommy');
registerSecretRole('secretdaddy', 'secretDaddy', 'Secret Daddy');

register(['usertodo'], 'Persönliche Aufgaben verwalten', async (ctx) => {
  const id = ctx.normalizeJid(ctx.sender);
  ctx.data.userTodos ||= {};
  ctx.data.userTodos[id] ||= [];
  const action = (ctx.args[0] || 'list').toLowerCase();
  if (action === 'list') {
    const todos = ctx.data.userTodos[id];
    return ctx.reply(todos.length
      ? `📝 Deine Aufgaben\n\n${todos.map((todo) => `${todo.done ? '✅' : '⬜'} #${todo.id} — ${todo.text}`).join('\n')}`
      : '📝 Deine Aufgabenliste ist leer.');
  }
  if (action === 'add') {
    const text = ctx.args.slice(1).join(' ').trim();
    if (!text) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}usertodo add <Aufgabe>`);
    const todo = { id: String(ctx.data.nextTodoId++), text, done: false, createdAt: Date.now() };
    ctx.data.userTodos[id].push(todo);
    ctx.saveData();
    return ctx.reply(`✅ Aufgabe #${todo.id} gespeichert: ${todo.text}`);
  }
  if (action === 'done') {
    const todo = ctx.data.userTodos[id].find((entry) => entry.id === ctx.args[1]);
    if (!todo) return ctx.reply(`Aufgabe nicht gefunden. Nutze ${commandPrefix(ctx)}usertodo list.`);
    todo.done = true;
    todo.completedAt = Date.now();
    ctx.saveData();
    return ctx.reply(`🌸 Aufgabe #${todo.id} erledigt.`);
  }
  if (action === 'clear') {
    ctx.data.userTodos[id] = [];
    ctx.saveData();
    return ctx.reply('🧹 Deine Aufgabenliste wurde geleert.');
  }
  return ctx.reply(`Nutzung: ${commandPrefix(ctx)}usertodo add|list|done|clear [ID|Text]`);
});

register(['balance', 'bitcoin', 'coins'], 'Bitcoin-Guthaben anzeigen', async (ctx) => {
  await ctx.reply(`₿ Du hast ${user(ctx).bitcoin} Bitcoin im Violette-System.`);
});

register(['hourly'], 'Alle 60 Minuten Bitcoin abholen', async (ctx) => {
  const account = user(ctx);
  const remaining = 3600000 - (Date.now() - account.lastHourly);
  if (remaining > 0) {
    await ctx.reply(`⏳ Du kannst in ${Math.ceil(remaining / 60000)} Minuten wieder Bitcoin abholen.`);
    return;
  }
  const reward = bitcoinReward(account, BITCOIN_PER_HOUR);
  account.bitcoin += reward;
  account.lastHourly = Date.now();
  ctx.saveData();
  await ctx.reply(`✅ +${reward} Bitcoin. Kontostand: ${account.bitcoin}`);
});

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

timedRewardCommand('daily', 'lastDaily', 24 * 3600000, DAILY_REWARD, 'Daily');
timedRewardCommand('weekly', 'lastWeekly', 7 * 24 * 3600000, WEEKLY_REWARD, 'Weekly');

register(['work'], 'Arbeiten und Bitcoin verdienen', async (ctx) => {
  const account = user(ctx);
  const cooldown = 3600000 - (Date.now() - account.lastWork);
  if (cooldown > 0) return ctx.reply(`⏳ Du kannst in ${Math.ceil(cooldown / 60000)} Minuten wieder arbeiten.`);
  const jobs = [
    ['im Café gearbeitet', 14, 20],
    ['eine Schicht im Einzelhandel gemacht', 16, 24],
    ['freiberuflich programmiert', 28, 45],
    ['eine Lieferung gefahren', 12, 22],
  ];
  const [job, minimum, maximum] = jobs[crypto.randomInt(jobs.length)];
  const reward = bitcoinReward(account, minimum + crypto.randomInt(maximum - minimum + 1));
  account.bitcoin += reward;
  account.lastWork = Date.now();
  ctx.saveData();
  await ctx.reply(`🛠️ Du hast ${job} und ${reward} Bitcoin verdient.`);
});

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

register(['shop'], 'Economy-Shop anzeigen', async (ctx) => {
  await ctx.reply(`🛒 VIOLETTE ECONOMY-SHOP\n\n${Object.entries(SHOP_ITEMS)
    .map(([name, item]) => `• ${name} — ${item.price} Bitcoin\n  ${item.description}`)
    .join('\n')}\n\nKaufen mit ${commandPrefix(ctx)}buy <item>`);
});

register(['buy'], 'Economy-Shop-Item kaufen', async (ctx) => {
  const itemName = (ctx.args[0] || '').toLowerCase();
  const item = SHOP_ITEMS[itemName];
  const account = user(ctx);
  if (!item) return ctx.reply(`Unbekanntes Item. Nutze ${commandPrefix(ctx)}shop.`);
  if (account.bitcoin < item.price) return ctx.reply(`Du brauchst ${item.price} Bitcoin.`);
  account.bitcoin -= item.price;
  account.inventory = [...new Set(account.inventory.concat(itemName))];
  if (item.duration && item.rank) account.vipUntil = Math.max(account.vipUntil, Date.now()) + item.duration;
  if (item.rank) account.rank = item.rank;
  if (itemName === 'luck') account.luck = Math.max(account.luck, 0) + 15;
  if (itemName === 'booster') account.boosterUntil = Math.max(account.boosterUntil || 0, Date.now()) + item.duration;
  ctx.saveData();
  await ctx.reply(`✅ ${itemName} gekauft. Verbleibend: ${account.bitcoin} Bitcoin.\n💡 Mehr Style und Profilextras findest du in ${commandPrefix(ctx)}me.`);
});

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

register(['bankkonto', 'bank'], 'Bankkonto eröffnen oder anzeigen', async (ctx) => {
  const account = user(ctx);
  if (!account.bankAccount) {
    const bankName = (ctx.args[0] || '').toLowerCase();
    if (!bankName) {
      return ctx.reply(`🏦 Banken:\n${Object.entries(BANKS).map(([name, bank]) => `• ${name} — Eröffnung ${bank.openingFee} Bitcoin, monatlich ${bank.monthlyFee} Bitcoin`).join('\n')}\n\nEröffnen mit ${commandPrefix(ctx)}bankkonto <Bank>`);
    }
    const bank = BANKS[bankName];
    if (!bank) return ctx.reply('Diese Bank gibt es nicht. Nutze #bankkonto für die Auswahl.');
    if (account.bitcoin < bank.openingFee) return ctx.reply(`Du brauchst ${bank.openingFee} Bitcoin für die Kontoeröffnung.`);
    account.bitcoin -= bank.openingFee;
    account.bankAccount = {
      bank: bankName,
      iban: `VIO${ctx.normalizeJid(ctx.sender).slice(-10)}`,
      balance: 0,
      openedAt: Date.now(),
      lastFeeAt: Date.now(),
    };
    ctx.saveData();
    return ctx.reply(`✅ Dein Konto bei ${bank.label} wurde eröffnet.\nIBAN: ${account.bankAccount.iban}\nKontoführung: ${bank.monthlyFee} Bitcoin pro Monat.`);
  }
  const fee = chargeBankFee(account);
  ctx.saveData();
  const bank = BANKS[account.bankAccount.bank];
  await ctx.reply(`🏦 ${bank.label}\nIBAN: ${account.bankAccount.iban}\nKontostand: ${account.bankAccount.balance} Bitcoin\n${fee ? `Kontoführungsgebühr: -${fee} Bitcoin\n` : ''}Monatlich: ${bank.monthlyFee} Bitcoin`);
});

register(['banktransfer', 'banküberweisung', 'bpay'], 'Bitcoin vom Bankkonto überweisen', async (ctx) => {
  const target = mentionJids(ctx)[0];
  const amount = parseAmount(ctx.args.find((arg) => /^\d+$/.test(arg)));
  const sender = user(ctx);
  if (!sender.bankAccount || !target || !amount || contextSame(ctx, target)) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}banktransfer @Nutzer <Betrag>`);
  }
  chargeBankFee(sender);
  const recipient = user(ctx, target);
  if (!recipient.bankAccount) return ctx.reply('Der Empfänger besitzt noch kein Bankkonto.');
  if (sender.bankAccount.balance < amount) return ctx.reply('Dein Bankkonto hat dafür nicht genug Guthaben.');
  sender.bankAccount.balance -= amount;
  recipient.bankAccount.balance += amount;
  ctx.saveData();
  await ctx.reply(`🏦💸 ${amount} Bitcoin wurden von deiner IBAN ${sender.bankAccount.iban} an ${displayUser(ctx, target)} überwiesen.`);
});

register(['bankeinzahlung', 'einzahlen', 'depositbank'], 'Bitcoin auf das Bankkonto einzahlen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const account = user(ctx);
  if (!account.bankAccount || !amount) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}bankeinzahlung <Betrag>`);
  if (account.bitcoin < amount) return ctx.reply('Deine Wallet hat dafür nicht genug Bitcoin.');
  chargeBankFee(account);
  account.bitcoin -= amount;
  account.bankAccount.balance += amount;
  ctx.saveData();
  await ctx.reply(`🏦 ${amount} Bitcoin eingezahlt. Bankguthaben: ${account.bankAccount.balance} Bitcoin.`);
});

register(['bankauszahlung', 'auszahlen', 'withdraw'], 'Bitcoin vom Bankkonto auszahlen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const account = user(ctx);
  if (!account.bankAccount || !amount) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}bankauszahlung <Betrag>`);
  chargeBankFee(account);
  if (account.bankAccount.balance < amount) return ctx.reply('Dein Bankkonto hat dafür nicht genug Guthaben.');
  account.bankAccount.balance -= amount;
  account.bitcoin += amount;
  ctx.saveData();
  await ctx.reply(`💳 ${amount} Bitcoin ausgezahlt. Wallet: ${account.bitcoin} Bitcoin.`);
});

register(['inventory'], 'Inventar und Economy-Vorteile anzeigen', async (ctx) => {
  const account = user(ctx);
  await ctx.reply(`🎒 Inventar: ${account.inventory.length ? account.inventory.join(', ') : 'leer'}\n⭐ VIP: ${isVip(account) ? 'aktiv' : 'inaktiv'}\n🍀 Glück: +${account.luck || 0}`);
});

register(['economy'], 'Economy-Übersicht anzeigen', async (ctx) => {
  const account = user(ctx);
  const deposits = account.deposits || [];
  await ctx.reply(`💼 Economy\n₿ Guthaben: ${account.bitcoin}\n🏦 Anlagen: ${deposits.length}\n🎒 Items: ${account.inventory.length}\nNutze ${commandPrefix(ctx)}deposit <Betrag> [Tage].`);
});

register(['deposit'], 'Bitcoin sicher anlegen', async (ctx) => {
  const amount = Number(ctx.args[0]);
  const days = Number(ctx.args[1] || 7);
  const account = user(ctx);
  if (!Number.isInteger(amount) || amount < 10 || amount > 100000 || !Number.isInteger(days) || days < 1 || days > 30) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}deposit <Betrag> [Tage] (10–100000 Bitcoin, 1–30 Tage)`);
  }
  if (account.bitcoin < amount) return ctx.reply('Du hast nicht genug Bitcoin.');
  account.deposits ||= [];
  if (account.deposits.reduce((sum, item) => sum + item.amount, 0) + amount > 500000) {
    return ctx.reply('Das Anlage-Limit von 500000 Bitcoin ist erreicht.');
  }
  account.bitcoin -= amount;
  account.deposits.push({ amount, dueAt: Date.now() + days * 86400000, rate: Math.min(days * 0.01, 0.3) });
  ctx.saveData();
  await ctx.reply(`🏦 ${amount} Bitcoin für ${days} Tage angelegt. Zinsen werden mit ${Math.round(Math.min(days * 0.01, 0.3) * 100)}% bei Fälligkeit ausgezahlt.`);
});

register(['interest'], 'Fällige Zinsen auszahlen', async (ctx) => {
  const account = user(ctx);
  const due = (account.deposits || []).filter((item) => item.dueAt <= Date.now());
  if (!due.length) return ctx.reply('Noch keine Anlage ist fällig.');
  const payout = due.reduce((sum, item) => sum + Math.floor(item.amount * (1 + (item.rate || 0))), 0);
  account.bitcoin += payout;
  account.deposits = (account.deposits || []).filter((item) => item.dueAt > Date.now());
  ctx.saveData();
  await ctx.reply(`✅ ${payout} Bitcoin inklusive Zinsen ausgezahlt.`);
});

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

register(['joke'], 'Einen Witz erzählen', async (ctx) => {
  const jokes = ['Warum sind Entwickler schlechte Geheimnisträger? Sie teilen alles mit Git.', 'Was macht ein Byte im Urlaub? Es nimmt sich eine Auszeit.'];
  await ctx.reply(`😄 ${jokes[crypto.randomInt(jokes.length)]}`);
});

register(['seb'], 'Harmlosen Roast über die fiktive Bot-Rivalenfigur Seb', async (ctx) => {
  const target = quotedNumber(ctx);
  const targetLabel = target ? displayName(ctx, target) : 'Seb';
  const roasts = [
    `🤖 ${targetLabel} lädt so lange, dass selbst der Ladebalken Feierabend macht.`,
    `🧃 ${targetLabel} hat heute wieder Beta-Charme: charmant, aber mit drei Warnmeldungen.`,
    `🛠️ ${targetLabel} nennt das Strategie – wir nennen es eine kreative Fehlermeldung.`,
    `📡 ${targetLabel} ist der einzige Bot, der beim Ping erstmal nach dem WLAN fragt.`,
    `🎭 ${targetLabel} wollte die Show stehlen, aber sein Textbaustein war noch im Entwurf.`,
  ];
  const mentions = target ? [mentionJid(ctx, target)] : [];
  await ctx.reply(roasts[crypto.randomInt(roasts.length)], { mentions });
});

register(['8ball'], 'Magische 8-Ball-Antwort', async (ctx) => {
  if (!ctx.args.length) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}8ball <Frage>`);
  const answers = ['Ja, definitiv.', 'Sieht gut aus.', 'Frag später noch einmal.', 'Eher nicht.', 'Die Zeichen stehen auf Nein.'];
  await ctx.reply(`🎱 ${answers[crypto.randomInt(answers.length)]}`);
});

register(['rate'], 'Etwas spielerisch bewerten', async (ctx) => {
  const value = ctx.args.join(' ').trim();
  if (!value) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}rate <Text>`);
  await ctx.reply(`⭐ "${value}" bekommt ${crypto.randomInt(1, 101)}/100.`);
});

register(['hug'], 'Nutzer umarmen', async (ctx) => {
  await runFunCommand(ctx, 'hug', (target) => `🤗 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} umarmt ${displayName(ctx, target)}!`);
});

register(['kiss'], 'Nutzer küssen', async (ctx) => {
  await runFunCommand(ctx, 'kiss', (target) => `💋 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} küsst ${displayName(ctx, target)}!`);
});

register(['slap'], 'Nutzer spielerisch ohrfeigen', async (ctx) => {
  await runFunCommand(ctx, 'slap', (target) => `👋 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} gibt ${displayName(ctx, target)} einen spielerischen Klaps!`);
});

register(['pat'], 'Nutzer den Kopf tätscheln', async (ctx) => {
  await runFunCommand(ctx, 'pat', (target) => `🐾 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} tätschelt ${displayName(ctx, target)}!`);
});

register(['fuck'], 'Frecher Spaßbefehl', async (ctx) => {
  if (!canUseSpicy(ctx)) return;
  await runFunCommand(ctx, 'fuck', (target) => `🔞 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} und ${displayName(ctx, target)} verschwinden für einen privaten Moment …`);
});

register(['aura'], 'Aura-Level anzeigen', async (ctx) => {
  const target = funTarget(ctx);
  const level = crypto.randomInt(1, 101);
  await runFunCommand(ctx, 'aura', () => `✨ Aura-Level von ${displayName(ctx, target)}: ${level}/100`);
});

register(['howgay'], 'Spielerischen Prozentwert anzeigen', async (ctx) => {
  const target = funTarget(ctx);
  const percentage = crypto.randomInt(0, 101);
  await runFunCommand(ctx, 'howgay', () => `🏳️‍🌈 Spaß-Wert für ${displayName(ctx, target)}: ${percentage}%`);
});

register(['ship'], 'Zwei Nutzer shippen', async (ctx) => {
  const targets = mentionJids(ctx).filter((jid, index, list) => list.indexOf(jid) === index);
  if (targets.length < 2) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}ship @Nutzer1 @Nutzer2`);
  const first = ctx.normalizeJid(targets[0]);
  const second = ctx.normalizeJid(targets[1]);
  const percentage = crypto.randomInt(0, 101);
  try {
    const response = await fetch(FUN_GIFS.ship);
    if (!response.ok) throw new Error(`GIF konnte nicht geladen werden (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await ctx.sock.sendMessage(ctx.jid, {
      video: buffer,
      gifPlayback: true,
      mimetype: 'video/mp4',
      caption: `💞 ${displayName(ctx, first)} + ${displayName(ctx, second)} Ship-Level: ${percentage}%`,
      mentions: [`${first}@s.whatsapp.net`, `${second}@s.whatsapp.net`],
    });

  } catch (error) {
    console.error('❌ GIF ship:', error);
    await ctx.reply('⚠️ Die Ship-Animation konnte gerade nicht geladen werden.');
  }
});

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

for (const [name, description, gif, template] of CUTE_FUN_COMMANDS) {
  register([name], description, async (ctx) => {
    await runFunCommand(ctx, gif, (target) => template
      .replace('{sender}', displayName(ctx, ctx.normalizeJid(ctx.sender)))
      .replace('{target}', displayName(ctx, target)));
  });
}

const SPICY_COMMANDS = [
  ['seduce', 'Nicht-grafisch verführen', null, '🌙 {sender} versucht, {target} mit mystischer Neon-Energie zu verführen 🔮'],
  ['makeout', 'Intensiven Kuss andeuten', null, '💋 {sender} und {target} kommen sich für einen intensiven Kuss näher …'],
  ['private', 'Privaten Moment andeuten', null, '🌌 {sender} und {target} verschwinden für einen sehr privaten Moment …'],
];

for (const [name, description, gif, template] of SPICY_COMMANDS) {
  register([name], description, async (ctx) => {
    if (!canUseSpicy(ctx)) return;
    const target = funTarget(ctx);
    if (!target) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}${name} @Nutzer`);
    const text = template
      .replace('{sender}', displayName(ctx, ctx.normalizeJid(ctx.sender)))
      .replace('{target}', displayName(ctx, target));
    if (gif) return runFunCommand(ctx, gif, () => text);
    await ctx.reply(text);
  });
}

register(['give'], 'Bitcoin vergeben (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Bitcoin mit diesem Befehl vergeben.');
  const target = mentionJids(ctx)[0];
  const amount = parseAmount(ctx.args.find((arg) => /^\d+$/.test(arg)));
  if (!amount || !target || contextSame(ctx, target)) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}give <@Nutzer> <Betrag>`);
  }
  user(ctx, target).bitcoin += amount;
  ctx.saveData();
  await ctx.reply(`✅ ${amount} Bitcoin wurden an den Nutzer vergeben.`);
});

register(['überweisung', 'transfer', 'pay'], 'Bitcoin an erwähnten Nutzer überweisen', async (ctx) => {
  const target = mentionJids(ctx)[0];
  const amount = parseAmount(ctx.args.find((arg) => /^\d+$/.test(arg)));
  if (!amount || !target || contextSame(ctx, target)) {
    await ctx.reply(`Nutzung: ${commandPrefix(ctx)}überweisung <@Nutzer> <Betrag>`);
    return;
  }
  const sender = user(ctx);
  if (sender.bitcoin < amount) return ctx.reply('Du hast nicht genug Bitcoin.');
  sender.bitcoin -= amount;
  user(ctx, target).bitcoin += amount;
  ctx.saveData();
  await ctx.reply(`💸 ${amount} Bitcoin wurden überwiesen.`);
});

register(['top', 'leaderboard'], 'Bitcoin-Rangliste anzeigen', async (ctx) => {
  const ranking = Object.entries(ctx.data.users)
    .sort(([, first], [, second]) => (second.bitcoin || second.coins || 0) - (first.bitcoin || first.coins || 0))
    .slice(0, 10)
    .map(([number, account], index) => `${index + 1}. ${displayName(ctx, number)} — ${account.bitcoin || account.coins || 0} Bitcoin`);
  await ctx.sock.sendMessage(ctx.jid, {
    text: ranking.length ? `🏆 Bitcoin-Rangliste\n${ranking.join('\n')}` : 'Noch keine Bitcoin-Daten vorhanden.',
    mentions: Object.entries(ctx.data.users)
      .sort(([, first], [, second]) => (second.bitcoin || second.coins || 0) - (first.bitcoin || first.coins || 0))
      .slice(0, 10)
      .map(([number]) => mentionJid(ctx, number)),
  });
});

function contextSame(ctx, target) {
  return ctx.normalizeJid(target) === ctx.normalizeJid(ctx.sender);
}

register(['coinflip', 'cf'], 'Bitcoin bei Kopf/Zahl setzen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  if (!amount) return ctx.reply('Nutzung: #coinflip <Betrag>');
  const account = user(ctx);
  if (account.bitcoin < amount) return ctx.reply('Du hast nicht genug Bitcoin.');
  const won = crypto.randomInt(0, 100) < 50 + Math.min((account.luck || 0) + (isVip(account) ? 10 : 0), 20);
  account.bitcoin += won ? amount : -amount;
  ctx.saveData();
  await ctx.reply(`${won ? '🪙 Kopf! Gewinn' : '🪙 Zahl! Verlust'}: ${amount} Bitcoin.\nKontostand: ${account.bitcoin}`);
});

register(['slots'], 'Slotmaschine spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  if (!amount) return ctx.reply('Nutzung: #slots <Betrag>');
  const account = user(ctx);
  if (account.bitcoin < amount) return ctx.reply('Du hast nicht genug Bitcoin.');
  const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
  const result = Array.from({ length: 3 }, () => symbols[crypto.randomInt(symbols.length)]);
  const luck = Math.min((account.luck || 0) + (isVip(account) ? 10 : 0), 20);
  const win = result.every((symbol) => symbol === result[0]) ? amount * 5 : result[0] === result[1] || result[1] === result[2] || crypto.randomInt(0, 100) < luck ? amount : 0;
  account.bitcoin += win - amount;
  ctx.saveData();
  await ctx.reply(`${result.join(' | ')}\n${win ? `🎉 Gewinn: ${win}` : 'Leider verloren.'} Bitcoin\nKontostand: ${account.bitcoin}`);
});

function casinoBet(context, amount) {
  const account = user(context);
  if (!amount) return { account, error: `Nutzung: ${commandPrefix(context)}<spiel> <Betrag>` };
  if (account.bitcoin < amount) return { account, error: 'Du hast nicht genug Bitcoin.' };
  return { account };
}

register(['dice'], 'Würfel-Casino spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const { account, error } = casinoBet(ctx, amount);
  if (error) return ctx.reply(error);
  const roll = crypto.randomInt(1, 7);
  const won = roll >= 5;
  account.bitcoin += won ? amount : -amount;
  ctx.saveData();
  await ctx.reply(`🎲 Du würfelst eine ${roll}.\n${won ? `Gewonnen: ${amount}` : `Verloren: ${amount}`} Bitcoin\nKontostand: ${account.bitcoin}`);
});

register(['roulette'], 'Roulette spielen', async (ctx) => {
  const choice = (ctx.args[0] || '').toLowerCase();
  const amount = parseAmount(ctx.args[1]);
  const { account, error } = casinoBet(ctx, amount);
  if (error || !['rot', 'schwarz', 'grün', 'gruen'].includes(choice)) {
    return ctx.reply(error || `Nutzung: ${commandPrefix(ctx)}roulette <rot|schwarz|grün> <Betrag>`);
  }
  const roll = crypto.randomInt(0, 37);
  const color = roll === 0 ? 'grün' : roll % 2 ? 'rot' : 'schwarz';
  const won = choice === color || (choice === 'gruen' && color === 'grün');
  account.bitcoin += won ? amount * 2 : -amount;
  ctx.saveData();
  await ctx.reply(`🎡 Roulette: ${roll} (${color})\n${won ? `Gewinn: ${amount * 2}` : `Verlust: ${amount}`} Bitcoin\nKontostand: ${account.bitcoin}`);
});

register(['highlow'], 'High-Low-Casino spielen', async (ctx) => {
  const choice = (ctx.args[0] || '').toLowerCase();
  const amount = parseAmount(ctx.args[1]);
  const { account, error } = casinoBet(ctx, amount);
  if (error || !['höher', 'niedriger', 'hoeher'].includes(choice)) {
    return ctx.reply(error || `Nutzung: ${commandPrefix(ctx)}highlow <höher|niedriger> <Betrag>`);
  }
  const card = crypto.randomInt(1, 14);
  const next = crypto.randomInt(1, 14);
  const won = (choice.startsWith('hö') || choice.startsWith('hoe')) ? next > card : next < card;
  account.bitcoin += won ? amount : -amount;
  ctx.saveData();
  await ctx.reply(`🃏 Karte: ${card}, nächste Karte: ${next}\n${won ? `Gewonnen: ${amount}` : `Verloren: ${amount}`} Bitcoin`);
});

register(['blackjack'], 'Blackjack spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const { account, error } = casinoBet(ctx, amount);
  if (error) return ctx.reply(error);
  const total = crypto.randomInt(14, 22);
  const won = total >= 19;
  account.bitcoin += won ? amount : -amount;
  ctx.saveData();
  await ctx.reply(`🂡 Deine Hand: ${total}\n${won ? `Blackjack-Gewinn: ${amount}` : `Verlust: ${amount}`} Bitcoin`);
});

register(['crash'], 'Crash-Multiplikator spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const { account, error } = casinoBet(ctx, amount);
  if (error) return ctx.reply(error);
  const multiplier = Math.max(1, Math.floor((1 + crypto.randomInt(0, 400) / 100) * 100) / 100);
  const won = multiplier >= 1.5;
  account.bitcoin += won ? Math.floor(amount * (multiplier - 1)) : -amount;
  ctx.saveData();
  await ctx.reply(`📈 Crash bei ${multiplier.toFixed(2)}x: ${won ? `Gewinn ${Math.floor(amount * (multiplier - 1))}` : `Verlust ${amount}`} Bitcoin.`);
});

register(['baccarat'], 'Baccarat spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const { account, error } = casinoBet(ctx, amount);
  if (error) return ctx.reply(error);
  const player = crypto.randomInt(0, 10);
  const banker = crypto.randomInt(0, 10);
  const won = player > banker;
  account.bitcoin += player === banker ? 0 : (won ? amount : -amount);
  ctx.saveData();
  await ctx.reply(`🃏 Baccarat: Spieler ${player}, Bank ${banker}. ${player === banker ? 'Unentschieden.' : won ? `Gewonnen: ${amount}` : `Verloren: ${amount}`} Bitcoin.`);
});

register(['lottery'], 'Lotterie spielen', async (ctx) => {
  const amount = parseAmount(ctx.args[0]);
  const { account, error } = casinoBet(ctx, amount);
  if (error) return ctx.reply(error);
  const won = crypto.randomInt(0, 100) === 0;
  account.bitcoin += won ? amount * 50 : -amount;
  ctx.saveData();
  await ctx.reply(`🎟️ Lotterie: ${won ? `Jackpot! +${amount * 50}` : `Leider verloren: ${amount}`} Bitcoin.`);
});

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

register(['warn'], 'Nutzer verwarnen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}warn @Nutzer [Grund]`);
  if (isOwner(ctx, number)) return ctx.reply('Owner können nicht verwarnt werden.');
  const settings = groupSettings(ctx);
  settings.warnings[number] ||= [];
  settings.warnings[number].push({ reason: ctx.args.slice(1).join(' ') || 'Kein Grund angegeben', at: Date.now(), by: ctx.sender });
  ctx.saveData();
  const latestWarning = settings.warnings[number][settings.warnings[number].length - 1];
  await ctx.reply(`⚠️ ${displayName(ctx, number)} verwarnt (${settings.warnings[number].length}/3).\nGrund: ${latestWarning.reason}`, {
    mentions: [mentionJid(ctx, number)],
  });

  if (settings.warnings[number].length >= 3 && await requireBotAdmin(ctx)) {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [`${number}@s.whatsapp.net`], 'remove');
    await ctx.reply('🛡️ Drei Verwarnungen erreicht: Nutzer wurde entfernt.');
  }
});

register(['invite'], 'Nutzer direkt hinzufügen oder per Gruppenlink einladen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = (ctx.args[0] || '').replace(/\D/g, '');
  if (!number || number.length < 7 || number.length > 15) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}invite <internationale Nummer>\nBeispiel: ${commandPrefix(ctx)}invite 491751234567`);
  }
  const targetJid = `${number}@s.whatsapp.net`;
  const metadata = await requireBotAdmin(ctx);
  if (!metadata) return;

  try {
    await ctx.sock.groupParticipantsUpdate(ctx.jid, [targetJid], 'add');
    return ctx.reply(`✅ ${displayUser(ctx, number)} wurde direkt zur Gruppe hinzugefügt.`);
  } catch (error) {
    console.error(`❌ invite add ${number}:`, error);
    const code = await ctx.sock.groupInviteCode(ctx.jid);
    if (!code) return ctx.reply('❌ Direktes Hinzufügen fehlgeschlagen und es konnte kein Einladungslink erstellt werden.');
    const inviteLink = `https://chat.whatsapp.com/${code}`;
    await ctx.sock.sendMessage(targetJid, {
      text: `💌 Du wurdest in eine WhatsApp-Gruppe eingeladen.\n\n${inviteLink}`,
    });
    return ctx.reply(`🔗 Direktes Hinzufügen wurde abgelehnt. Ein Einladungslink wurde an ${displayUser(ctx, number)} gesendet.`);
  }
});

register(['inviteall'], 'Mehrere ausdrücklich angegebene Nummern einladen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const values = ctx.args.map((value) => value.replace(/\D/g, '')).filter((number) => number.length >= 7 && number.length <= 15);
  if (!values.length) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}inviteall <Nummer1> <Nummer2> ...\nGruppenlinks können aus Datenschutzgründen nicht automatisch in Mitgliederlisten umgewandelt werden.`);
  }
  if (!(await requireBotAdmin(ctx))) return;
  const uniqueNumbers = [...new Set(values)];
  const results = await Promise.allSettled(uniqueNumbers.map((number) => (
    ctx.sock.groupParticipantsUpdate(ctx.jid, [`${number}@s.whatsapp.net`], 'add')
  )));
  const added = results.filter((result) => result.status === 'fulfilled').length;
  const failed = uniqueNumbers.length - added;
  await ctx.reply(`📨 Einladung abgeschlossen: ${added} hinzugefügt, ${failed} fehlgeschlagen.`);
});

register(['warnings'], 'Verwarnungen anzeigen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}warnings @Nutzer`);
  const entries = groupSettings(ctx).warnings[number] || [];
  await ctx.reply(entries.length
    ? `⚠️ Verwarnungen für ${displayName(ctx, number)}:\n${entries.map((entry, index) => `${index + 1}. ${entry.reason}`).join('\n')}`
    : `✅ ${displayName(ctx, number)} hat keine Verwarnungen.`, { mentions: [mentionJid(ctx, number)] });
});

register(['clearwarns'], 'Verwarnungen löschen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}clearwarns @Nutzer`);
  delete groupSettings(ctx).warnings[number];
  ctx.saveData();
  await ctx.reply(`✅ Verwarnungen für ${displayName(ctx, number)} gelöscht.`, { mentions: [mentionJid(ctx, number)] });
});

register(['mute'], 'Nutzer zeitweise stummschalten (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = targetNumber(ctx, ctx.args[0]);
  const minutes = Number(ctx.args.find((arg) => /^\d+$/.test(arg)));
  if (!number || !Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}mute @Nutzer <Minuten>`);
  }
  if (isOwner(ctx, number)) return ctx.reply('Owner können nicht stummgeschaltet werden.');
  groupSettings(ctx).mutes[number] = Date.now() + minutes * 60000;
  ctx.saveData();
  await ctx.reply(`🔇 ${displayName(ctx, number)} wurde für ${minutes} Minuten stummgeschaltet.`, { mentions: [mentionJid(ctx, number)] });
});

register(['unmute'], 'Stummschaltung aufheben (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const number = targetNumber(ctx, ctx.args[0]);
  if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}unmute @Nutzer`);
  delete groupSettings(ctx).mutes[number];
  ctx.saveData();
  await ctx.reply(`✅ Stummschaltung für ${displayName(ctx, number)} aufgehoben.`, { mentions: [mentionJid(ctx, number)] });
});

for (const setting of ['antilink', 'antisticker']) {
  register([setting], `${setting === 'antilink' ? 'Gruppenlinks' : 'Sticker'} automatisch moderieren (Owner/Mods)`, async (ctx) => {
    if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
    const action = (ctx.args[0] || 'status').toLowerCase();
    if (!['on', 'off', 'status'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}${setting} on|off|status`);
    const settings = groupSettings(ctx);
    if (action !== 'status') {
      settings[setting] = action === 'on';
      ctx.saveData();
    }
    await ctx.reply(`🛡️ ${setting} ist ${settings[setting] ? 'AKTIV' : 'AUS'}.`);
  });
}

register(['addmod'], 'Moderator ernennen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Moderatoren ernennen.');
  const target = mentionJids(ctx)[0];
  const number = ctx.normalizeJid(target);
  if (!number) return ctx.reply('Erwähne die Person: #addmod @Nutzer');
  if (!ctx.data.mods.includes(number)) ctx.data.mods.push(number);
  ctx.saveData();
  await ctx.reply('✅ Moderator hinzugefügt.');
});

register(['delmod'], 'Moderator entfernen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Moderatoren entfernen.');
  const number = ctx.normalizeJid(mentionJids(ctx)[0]);
  ctx.data.mods = ctx.data.mods.filter((mod) => mod !== number);
  ctx.saveData();
  await ctx.reply('✅ Moderator entfernt.');
});

register(['addsupport'], 'Support ernennen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Support ernennen.');
  const number = ctx.normalizeJid(mentionJids(ctx)[0]);
  if (!number) return ctx.reply('Erwähne die Person: #addsupport @Nutzer');
  if (!ctx.data.support.includes(number)) ctx.data.support.push(number);
  ctx.saveData();
  await ctx.reply('✅ Support hinzugefügt.');
});

register(['delsupport'], 'Support entfernen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Support entfernen.');
  const number = ctx.normalizeJid(mentionJids(ctx)[0]);
  ctx.data.support = ctx.data.support.filter((person) => person !== number);
  ctx.saveData();
  await ctx.reply('✅ Support entfernt.');
});

register(['kick', 'remove'], 'Erwähnten Nutzer entfernen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  const targets = mentionJids(ctx);
  if (!targets.length) return ctx.reply('Erwähne mindestens eine Person.');
  await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, 'remove');
  await ctx.reply('✅ Nutzer entfernt.');
});

register(['promote'], 'Erwähnten Nutzer zum Admin machen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  await ctx.sock.groupParticipantsUpdate(ctx.jid, mentionJids(ctx), 'promote');
  await ctx.reply('✅ Nutzer befördert.');
});

register(['selfpromote'], 'Sich selbst zum Gruppenadmin machen (Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [mentionJid(ctx, ctx.sender)], 'promote');
  await ctx.reply(`✅ ${displayName(ctx, ctx.normalizeJid(ctx.sender))} wurde zum Gruppenadmin befördert.`, {
    mentions: [mentionJid(ctx, ctx.sender)],
  });
});

register(['selfdemote'], 'Sich selbst zum normalen Mitglied machen (Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  await ctx.sock.groupParticipantsUpdate(ctx.jid, [mentionJid(ctx, ctx.sender)], 'demote');
  await ctx.reply(`✅ ${displayName(ctx, ctx.normalizeJid(ctx.sender))} ist jetzt wieder normales Mitglied.`, {
    mentions: [mentionJid(ctx, ctx.sender)],
  });
});

register(['demote'], 'Adminrechte entziehen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  await ctx.sock.groupParticipantsUpdate(ctx.jid, mentionJids(ctx), 'demote');
  await ctx.reply('✅ Adminrechte entzogen.');
});

register(['tagall'], 'Alle Gruppenmitglieder erwähnen', async (ctx) => {
  const metadata = await requireBotAdmin(ctx);
  if (!metadata) return;
  const mentions = metadata.participants.map((participant) => participant.id);
  await ctx.sock.sendMessage(ctx.jid, { text: ctx.args.join(' ') || '📢 Alle', mentions });
});

register(['lock'], 'Gruppe sperren oder öffnen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  const action = (ctx.args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}lock on|off`);
  const settings = groupSettings(ctx);
  try {
    await ctx.sock.groupSettingUpdate(ctx.jid, action === 'on' ? 'announcement' : 'not_announcement');
  } catch (error) {
    return ctx.reply('Die Gruppeneinstellung konnte nicht geändert werden.');
  }
  settings.locked = action === 'on';
  ctx.saveData();
  await ctx.reply(action === 'on' ? '🔒 Gruppe gesperrt (nur Admins können schreiben).' : '🔓 Gruppe wieder geöffnet.');
});

register(['slowmode'], 'Gruppen-Slowmode setzen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
  const seconds = Number(ctx.args[0] || 0);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}slowmode <0–3600 Sekunden>`);
  const settings = groupSettings(ctx);
  settings.slowmode = seconds;
  settings.slowmodeUsers = {};
  ctx.saveData();
  await ctx.reply(seconds ? `🐢 Slowmode auf ${seconds} Sekunden gesetzt.` : '🐇 Slowmode deaktiviert.');
});

register(['clear'], 'Aktuelle Nachricht löschen', async (ctx) => {
  if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
  const key = ctx.message?.key;
  if (!key) return ctx.reply('Keine löschbare Nachricht gefunden.');
  try {
    await ctx.sock.sendMessage(ctx.jid, { delete: key });
    await ctx.reply('🧹 Nachricht gelöscht.');
  } catch (error) {
    await ctx.reply('Die Nachricht konnte nicht gelöscht werden.');
  }
});

register(['bcgroup', 'bcgroups'], 'Broadcast-Gruppen verwalten (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Broadcast-Gruppen verwalten.');
  ctx.data.broadcastGroups ||= [];
  const action = (ctx.args[0] || 'list').toLowerCase();
  if (action === 'list') {
    if (!ctx.data.broadcastGroups.length) {
      return ctx.reply('📢 Broadcast ist für alle Gruppen aktiviert, in denen der Bot Admin ist.');
    }
    const rows = [];
    for (const group of ctx.data.broadcastGroups) {
      try {
        const metadata = await ctx.sock.groupMetadata(group);
        rows.push(`• ${metadata.subject || group}\n  ${group}`);
      } catch {
        rows.push(`• ${group} (nicht abrufbar)`);
      }
    }
    return ctx.reply(`📢 Ausgewählte Broadcast-Gruppen:\n${rows.join('\n')}`);
  }
  if (!['add', 'remove'].includes(action)) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}bcgroup list|add|remove\nIn einer Gruppe genügt ${commandPrefix(ctx)}bcgroup add.`);
  }
  const target = ctx.isGroup ? ctx.jid : (ctx.args[1] || '').trim();
  if (!target || !target.endsWith('@g.us')) {
    return ctx.reply(`Nutzung: ${commandPrefix(ctx)}bcgroup ${action} in einer Gruppe oder mit Gruppen-ID.`);
  }
  if (action === 'add' && !ctx.data.broadcastGroups.includes(target)) ctx.data.broadcastGroups.push(target);
  if (action === 'remove') ctx.data.broadcastGroups = ctx.data.broadcastGroups.filter((group) => group !== target);
  ctx.saveData();
  await ctx.reply(action === 'add'
    ? '✅ Diese Gruppe ist jetzt für Broadcasts ausgewählt.'
    : '✅ Diese Gruppe wurde aus der Broadcast-Liste entfernt.');
});

register(['bc'], 'Broadcast an ausgewählte Gruppen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Broadcasts senden.');
  const text = ctx.args.join(' ').trim();
  if (!text) return ctx.reply('Nutzung: #bc <Nachricht>');
  const groups = Object.keys(await ctx.sock.groupFetchAllParticipating());
  const selectedGroups = ctx.data.broadcastGroups?.length
    ? groups.filter((group) => ctx.data.broadcastGroups.includes(group))
    : groups;
  const botIds = [ctx.sock.user?.id, ctx.sock.user?.lid, ctx.sock.user?.phoneNumber].filter(Boolean);
  const sent = [];
  const skipped = [];
  for (const group of selectedGroups) {
    try {
      const metadata = await ctx.sock.groupMetadata(group);
      const bot = metadata.participants.find((participant) => (
        botIds.some((botId) => [participant.id, participant.lid, participant.phoneNumber].some((candidate) => (
          candidate
          && (
            areJidsSameUser(candidate, botId)
            || ctx.normalizeJid(candidate) === ctx.normalizeJid(botId)
          )
        )))
      ));
      const botIsAdmin = Boolean(bot && (
        ['admin', 'superadmin'].includes(bot.admin) || bot.isAdmin || bot.isSuperAdmin
      ));
      if (!botIsAdmin) {
        skipped.push(`${metadata.subject || group} (Bot ist kein Admin)`);
        continue;
      }
      await ctx.sock.sendMessage(group, { text: `📢 Broadcast:\n${text}` });
      sent.push(metadata.subject || group);
    } catch (error) {
      console.error(`❌ Broadcast für ${group}:`, error);
      skipped.push(`${group} (Fehler)`);
    }
  }
  await ctx.reply(`✅ Broadcast gesendet: ${sent.length} Gruppen${
    skipped.length ? `\n⏭️ Übersprungen: ${skipped.length}\n${skipped.map((entry) => `• ${entry}`).join('\n')}` : ''
  }${ctx.data.broadcastGroups?.length ? `\n🎯 Auswahl: ${ctx.data.broadcastGroups.length} Gruppen` : '\n🎯 Auswahl: alle Admin-Gruppen'}`);
});

register(['teamlist'], 'Teammitglieder anzeigen', async (ctx) => {
  await ctx.reply(`👥 Team\n👑 Owner: ${ctx.ownerNumbers.map((number) => displayUser(ctx, number)).join(', ')}\n🛡️ Mods: ${ctx.data.mods.length ? ctx.data.mods.map((number) => displayUser(ctx, number)).join(', ') : 'keine'}\n🆘 Support: ${ctx.data.support.length ? ctx.data.support.map((number) => displayUser(ctx, number)).join(', ') : 'keiner'}`);
});

register(['modinfo'], 'Moderatorinformationen anzeigen', async (ctx) => {
  const target = ctx.args.length ? targetNumber(ctx, ctx.args[0]) : ctx.normalizeJid(ctx.sender);
  if (!target) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}modinfo [@Nutzer]`);
  await ctx.reply(`🛡️ ${displayName(ctx, target)}\nRolle: ${isOwner(ctx, target) ? 'Owner' : ctx.data.mods.includes(target) ? 'Moderator' : ctx.data.support.includes(target) ? 'Support' : 'Keine Teamrolle'}`);
});

register(['teamhelp'], 'Teamhilfe anzeigen', async (ctx) => {
  await ctx.reply(`👥 Teamhilfe\n${commandPrefix(ctx)}teamlist · Team anzeigen\n${commandPrefix(ctx)}modinfo [@Nutzer] · Rolle prüfen\n${commandPrefix(ctx)}suggest <Idee> · Befehlsidee einreichen\n${commandPrefix(ctx)}warn, ${commandPrefix(ctx)}mute, ${commandPrefix(ctx)}lock · Gruppenmoderation`);
});

register(['suggest'], 'Einen neuen Befehlsvorschlag einreichen', async (ctx) => {
  const text = ctx.args.join(' ').trim();
  if (!text) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}suggest <deine Befehlsidee>`);
  ctx.data.suggestions ||= {};
  const id = String(ctx.data.nextSuggestionId++);
  ctx.data.suggestions[id] = {
    id, text, author: ctx.normalizeJid(ctx.sender), createdAt: Date.now(), status: 'pending',
  };
  ctx.saveData();
  await ctx.reply(`💡 Vorschlag #${id} wurde eingereicht. Der Owner entscheidet mit ${commandPrefix(ctx)}suggestion ${id} yes|no.`);
});

register(['suggestions', 'ideas'], 'Offene Befehlsvorschläge anzeigen', async (ctx) => {
  ctx.data.suggestions ||= {};
  const entries = Object.values(ctx.data.suggestions).filter((entry) => entry.status === 'pending');
  if (!entries.length) return ctx.reply('💡 Es gibt aktuell keine offenen Befehlsvorschläge.');
  await ctx.reply(`💡 OFFENE VORSCHLÄGE\n\n${entries
    .map((entry) => `#${entry.id} — ${entry.text}\n   von @${displayUser(ctx, entry.author)}`)
    .join('\n\n')}`);
});

register(['suggestion', 'decide'], 'Befehlsvorschlag annehmen oder ablehnen (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Vorschläge entscheiden.');
  const id = ctx.args[0];
  const decision = (ctx.args[1] || '').toLowerCase();
  const suggestion = ctx.data.suggestions?.[id];
  if (!suggestion || suggestion.status !== 'pending') return ctx.reply('Vorschlag nicht gefunden oder bereits entschieden.');
  if (!['yes', 'no'].includes(decision)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}suggestion <ID> yes|no`);
  suggestion.status = decision === 'yes' ? 'accepted' : 'rejected';
  suggestion.decidedAt = Date.now();
  suggestion.decidedBy = ctx.normalizeJid(ctx.sender);
  ctx.saveData();
  await ctx.reply(`${decision === 'yes' ? '✅ Angenommen' : '❌ Abgelehnt'}: Vorschlag #${id}\n${suggestion.text}`);
});

register(['botstats'], 'Bot-Statistiken anzeigen', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Bot-Statistiken anzeigen.');
  const groups = ctx.sock.groupFetchAllParticipating ? await ctx.sock.groupFetchAllParticipating() : {};
  await ctx.reply(`📊 Botstats\nNutzer: ${Object.keys(ctx.data.users).length}\nGruppen: ${Object.keys(groups).length}\nBefehle: ${new Set(commands.values()).size}`);
});

register(['reload'], 'Botdaten neu laden', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Daten neu laden.');
  await ctx.reply('♻️ Die aktuelle Datendatei wird bei jedem Befehl konsistent gespeichert. Ein Prozessneustart ist nicht erforderlich.');
});

register(['maintenance', 'maint'], 'Wartungsmodus (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der echte Owner darf den Wartungsmodus ändern.');
  const action = (ctx.args[0] || 'status').toLowerCase();
  ctx.data.settings ||= {};
  if (!['on', 'off', 'status'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}maintenance on|off|status`);
  if (action !== 'status') {
    ctx.data.settings.maintenance = action === 'on';
    ctx.saveData();
  }
  await ctx.reply(`🔧 Wartungsmodus: ${ctx.data.settings.maintenance ? 'AKTIV' : 'AUS'}`);
});

register(['mt'], 'Befehle in Wartung setzen und verwalten (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf einzelne Befehle in Wartung setzen.');
  const action = (ctx.args[0] || '').toLowerCase();
  ctx.data.settings ||= {};
  ctx.data.settings.commandMaintenance ||= {};
  if (action === 'list') {
    const targets = Object.keys(ctx.data.settings.commandMaintenance)
      .filter((name) => ctx.data.settings.commandMaintenance[name])
      .sort();
    return ctx.reply(targets.length
      ? `🔧 Befehle in Wartung:\n${targets.map((name) => `• ${commandPrefix(ctx)}${name}`).join('\n')}`
      : '✅ Aktuell befindet sich kein Befehl in Wartung.');
  }
  const target = (ctx.args[1] || '').toLowerCase().replace(/^#/, '');
  if (!['add', 'remove'].includes(action) || !target || !commands.has(target) || target === 'mt') {
    return ctx.reply(`Nutzung:\n${commandPrefix(ctx)}mt add <befehl>\n${commandPrefix(ctx)}mt list\n${commandPrefix(ctx)}mt remove <befehl>`);
  }
  ctx.data.settings.commandMaintenance[target] = action === 'add';
  ctx.saveData();
  await ctx.reply(action === 'add'
    ? `🔧 ${commandPrefix(ctx)}${target} wurde in Wartung gesetzt.`
    : `✅ ${commandPrefix(ctx)}${target} wurde aus der Wartung entfernt.`);
});

register(['alias'], 'Eigene Kurzbefehle verwalten (nur Owner)', async (ctx) => {
  if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Kurzbefehle verwalten.');
  const action = (ctx.args[0] || 'list').toLowerCase();
  ctx.data.aliases ||= {};
  if (action === 'list') {
    const entries = Object.entries(ctx.data.aliases).sort(([first], [second]) => first.localeCompare(second));
    return ctx.reply(entries.length
      ? `🔗 Eigene Kurzbefehle:\n${entries.map(([name, target]) => `• ${commandPrefix(ctx)}${name} → ${commandPrefix(ctx)}${target}`).join('\n')}`
      : '🔗 Es wurden noch keine eigenen Kurzbefehle angelegt.');
  }
  const name = (ctx.args[1] || '').toLowerCase().replace(/^#/, '');
  const target = (ctx.args[2] || '').toLowerCase().replace(/^#/, '');
  const protectedNames = new Set(['alias', 'mt', 'maintenance']);
  if (action === 'remove') {
    if (!name || !ctx.data.aliases[name]) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}alias remove <Kurzname>`);
    delete ctx.data.aliases[name];
    ctx.saveData();
    return ctx.reply(`✅ Kurzbefehl ${commandPrefix(ctx)}${name} wurde gelöscht.`);
  }
  if (action !== 'add' || !name || !target || protectedNames.has(name) || commands.has(name) || !commands.has(target) || name === target) {
    return ctx.reply(`Nutzung:\n${commandPrefix(ctx)}alias add <Kurzname> <Befehl>\n${commandPrefix(ctx)}alias remove <Kurzname>\n${commandPrefix(ctx)}alias list`);
  }
  ctx.data.aliases[name] = target;
  ctx.saveData();
  await ctx.reply(`✅ ${commandPrefix(ctx)}${name} → ${commandPrefix(ctx)}${target} wurde gespeichert.`);
});

register(['join'], 'Bot-Beitritt anfordern', async (ctx) => {
  const link = ctx.args[0] || '';
  const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,24})/);
  if (!match) return ctx.reply('Nutzung: #join https://chat.whatsapp.com/<Code>');
  const id = String(ctx.data.nextRequestId++);
  ctx.data.joinRequests[id] = { id, link: match[1], requester: ctx.sender, createdAt: Date.now(), status: 'pending' };
  ctx.saveData();
  const recipients = [...new Set([ctx.ownerNumber, ...ctx.data.mods, ...ctx.data.support])].map((number) => `${number}@s.whatsapp.net`);
  for (const recipient of recipients) await ctx.sock.sendMessage(recipient, { text: `🔔 Join-Anfrage #${id} von ${displayUser(ctx, ctx.sender)}\nMit #approvejoin ${id} oder #rejectjoin ${id} bearbeiten.` });
  await ctx.reply(`✅ Anfrage #${id} wurde an Owner, Mods und Support gesendet.`);
});

register(['approvejoin'], 'Join-Anfrage annehmen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Join-Anfragen annehmen.');
  const request = ctx.data.joinRequests[ctx.args[0]];
  if (!request || request.status !== 'pending') return ctx.reply('Anfrage nicht gefunden oder bereits bearbeitet.');
  const groupJid = await ctx.sock.groupAcceptInvite(request.link);
  request.status = 'approved';
  request.groupJid = groupJid;
  ctx.saveData();
  await ctx.reply(`✅ Beigetreten. Anfrage #${request.id} abgeschlossen.`);
});

register(['rejectjoin'], 'Join-Anfrage ablehnen (Owner/Mods)', async (ctx) => {
  if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Join-Anfragen ablehnen.');
  const request = ctx.data.joinRequests[ctx.args[0]];
  if (!request || request.status !== 'pending') return ctx.reply('Anfrage nicht gefunden oder bereits bearbeitet.');
  request.status = 'rejected';
  ctx.saveData();
  await ctx.reply(`✅ Anfrage #${request.id} abgelehnt.`);
});

function createCommandContext(values) {
  return {
    ...values,
    reply: (text, options = {}) => values.sock.sendMessage(values.jid, {
      text: styledCommandReply(text, values.commandName),
      __delayMs: values.responseDelayMs,
      ...options,
    }),
  };
}

function getCommandHelp(prefix) {
  const unique = [...new Set(commands.values())];
  return `📚 Project Violette\n\n${unique.map((command) => `${prefix}${command.names[0]} - ${command.description}`).join('\n')}`;
}

module.exports = {
  commands,
  createCommandContext,
  getCommandHelp,
  cloneGroup,
  communityJidFromMetadata,
  linkedCommunityGroups,
  resolveCommunityContext,
};
