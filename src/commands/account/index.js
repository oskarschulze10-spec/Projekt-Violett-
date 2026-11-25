'use strict';

module.exports = (runtime) => {
  const {
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
  } = runtime;

  return [
  {
    order: 49218,
    register() {
      register(['register'], 'Register a name for Violette', async (ctx) => {
        if (!ctx.isGroup) return ctx.reply('Privacy acceptance and registration are only available in groups.');
        if (!user(ctx).privacyAccepted || user(ctx).privacyVersion !== PRIVACY_VERSION) {
          return ctx.reply(`Please accept the privacy notice first with ${commandPrefix(ctx)}dsgvo accept.`);
        }
        const name = ctx.args.join(' ').trim();
        if (!name || name.length < 2 || name.length > 40) {
          return ctx.reply(`Usage: ${commandPrefix(ctx)}register <name> (2 to 40 characters)`);
        }
        if (!/^\d{7,15}$/.test(String(ctx.phoneNumber || '')) || !ctx.senderLid) {
          return ctx.reply('Your phone number or WhatsApp LID could not be verified. Please try again after synchronization.');
        }
        const account = user(ctx);
        account.displayName = name;
        account.phoneNumber = ctx.phoneNumber;
        account.lid = ctx.senderLid || null;
        account.lids = [...new Set([
          ...(Array.isArray(account.lids) ? account.lids : []),
          ctx.senderLid,
        ].filter(Boolean))];
        account.registeredAt = new Date().toISOString();
        ctx.saveData();
        await ctx.reply(`Account registered. Welcome, ${name}.`);
      });
    },
  },
  {
    order: 52247,
    register() {
      register(['dsgvo'], 'Show and accept the privacy notice', async (ctx) => {
        if (!ctx.isGroup) return ctx.reply('Privacy acceptance and registration are only available in groups.');
        const account = user(ctx);
        if (!['accept', 'akzeptieren'].includes((ctx.args[0] || '').toLowerCase())) {
          await ctx.reply(
            '🔐 PRIVACY NOTICE\n\n' +
            'Violette stores your phone number, WhatsApp LID (if available), display name, ' +
            'your consent and account data such as wallet balance locally. Data is stored in ' +
            'the bot data folder (normally data/bot-data.json and data/users/). WhatsApp messages are processed ' +
            `to provide bot features. Use ${commandPrefix(ctx)}deleteaccount to remove your account. ` +
            'Privacy acceptance and registration are only available in groups. A verifiable phone number and LID are required.\n\n' +
            `If you agree, use: ${commandPrefix(ctx)}dsgvo accept`,
          );
          return;
        }
        account.privacyAccepted = true;
        account.privacyAcceptedAt = new Date().toISOString();
        account.privacyVersion = PRIVACY_VERSION;
        account.phoneNumber = ctx.phoneNumber || null;
        account.lid = ctx.senderLid || null;
        account.lids = [...new Set([
          ...(Array.isArray(account.lids) ? account.lids : []),
          ctx.senderLid,
        ].filter(Boolean))];
        ctx.saveData();
        await ctx.reply(`Privacy notice accepted. Now register with ${commandPrefix(ctx)}register <name>.`);
      });
    },
  },
  {
    order: 59460,
    register() {
      register(['profile'], 'Eigenes PV-Profil anzeigen', async (ctx) => {
        const account = user(ctx);
        const rank = getStaffRank(ctx);
        await ctx.reply(`👤 ${account.displayName || 'Unregistriert'}\n🏷️ Rang: ${rank}\n₿ Bitcoin: ${account.bitcoin}\n⭐ VIP: ${isVip(account) ? 'aktiv' : 'inaktiv'}`);
      });
      register(['pb'], 'WhatsApp-Profilbild und öffentliche Profildaten einer Nummer anzeigen', async (ctx) => {
        const rawNumber = ctx.args.join('').replace(/[^\d]/g, '');
        if (!rawNumber || rawNumber.length < 7 || rawNumber.length > 15) {
          return ctx.reply(`Nutzung: ${commandPrefix(ctx)}pb <Ländervorwahl + Nummer>\nBeispiel: ${commandPrefix(ctx)}pb 491701234567`);
        }
        let registration;
        try {
          if (typeof ctx.sock.onWhatsApp !== 'function') {
            return ctx.reply('❌ Diese Baileys-Version unterstützt die WhatsApp-Registrierungsabfrage nicht.');
          }
          const results = await ctx.sock.onWhatsApp(rawNumber);
          registration = Array.isArray(results) ? results.find((entry) => entry?.jid) : null;
        } catch (error) {
          console.error('WhatsApp-Registrierungsabfrage fehlgeschlagen:', error);
          return ctx.reply('⚠️ Die WhatsApp-Registrierung konnte gerade nicht abgefragt werden.');
        }
        if (!registration?.exists) {
          return ctx.reply(`🔎 Nummer: +${rawNumber}\n📱 Bei WhatsApp registriert: Nein\n🖼️ Profilbild: nicht verfügbar`);
        }
        const targetJid = registration.jid;
        let statusText = 'Nicht öffentlich abrufbar';
        try {
          if (typeof ctx.sock.fetchStatus === 'function') {
            const status = await ctx.sock.fetchStatus(targetJid);
            const entry = Array.isArray(status) ? status[0] : status;
            if (typeof entry?.status === 'string' && entry.status.trim()) statusText = entry.status.trim();
          }
        } catch (error) {
          console.error('WhatsApp-Info konnte nicht geladen werden:', error.message);
        }
        const caption = [
          '🪪 WHATSAPP-PROFIL',
          `📞 Nummer: +${rawNumber}`,
          '📱 Bei WhatsApp registriert: Ja',
          `📝 Info/Status: ${statusText}`,
          '🚫 WhatsApp-Bann: Nicht öffentlich feststellbar',
          '🗓️ Bann seit: Nicht verfügbar',
          '📅 Registrierungsdatum: Nicht öffentlich verfügbar',
        ].join('\n');
        try {
          const picture = await ctx.sock.profilePictureUrl(targetJid, 'image');
          if (picture) {
            await ctx.sock.sendMessage(ctx.jid, { image: { url: picture }, caption });
            return;
          }
        } catch (error) {
          console.error('WhatsApp-Profilbild konnte nicht geladen werden:', error.message);
        }
        await ctx.reply(`${caption}\n🖼️ Profilbild: Nicht sichtbar oder nicht freigegeben.`);
      });
    },
  },
  {
    order: 59704,
    register() {
      register(['account'], 'Account-Übersicht anzeigen', async (ctx) => {
        const account = user(ctx);
        await ctx.reply(`👤 ${account.displayName || 'Unregistriert'}\n🆔 ${displayUser(ctx, ctx.sender)}\n₿ Wallet: ${account.bitcoin} Bitcoin\n🏦 Bank: ${account.bankAccount ? `${account.bankAccount.balance} Bitcoin` : 'kein Konto'}\n🔞 18+: ${account.adultConfirmed ? 'aktiv' : 'inaktiv'}`);
      });
    },
  },
  {
    order: 60101,
    register() {
      register(['privacy'], 'Show privacy status', async (ctx) => {
        const account = user(ctx);
        const accepted = account.privacyAccepted && account.privacyVersion === PRIVACY_VERSION;
        await ctx.reply(`🔐 Privacy: ${accepted ? 'accepted' : 'not accepted'}\nStored locally: phone number, WhatsApp LID (if available), name and account data. Delete with ${commandPrefix(ctx)}deleteaccount.`);
      });
    },
  },
  {
    order: 60399,
    register() {
      register(['deleteaccount'], 'Eigene Accountdaten löschen', async (ctx) => {
        const id = ctx.normalizeJid(ctx.sender);
        if (!ctx.data.users[id]) return ctx.reply('No account data is stored for you.');
        delete ctx.data.users[id];
        delete ctx.data.userTodos?.[id];
        ctx.saveData();
        await ctx.reply('Your account data has been deleted. Accept the privacy notice and register again to use Violette.');
      });
    },
  },
  {
    order: 60797,
    register() {
      register(['me'], 'Eigene Violette-Karte anzeigen', async (ctx) => {
        const account = user(ctx);
        const rank = getStaffRank(ctx);
        const vipActive = isVip(account);
        const vipDays = vipActive ? Math.ceil((account.vipUntil - Date.now()) / 86400000) : 0;
        const registeredAt = account.registeredAt && Number.isFinite(Date.parse(account.registeredAt))
          ? new Date(account.registeredAt).toLocaleString('de-DE')
          : 'Nicht registriert';
        const lid = account.lid
          || (Array.isArray(account.lids) ? account.lids[0] : null)
          || ctx.senderLid
          || 'Nicht verfügbar';
        await ctx.reply(`╭━━━ 💜 YOUR VIOLETTE CARD ━━━╮\n`
          + `│ Name: ${account.displayName || 'Unregistriert'}\n`
          + `│ Rang: ${rank}\n`
          + `│ Bitcoin: ${account.bitcoin}\n`
          + `│ Registriert: ${registeredAt}\n`
          + `│ VIP: ${vipActive ? `Ja (${vipDays} Tage)` : 'Nein'}\n`
          + `│ LID (JID): ${lid}\n`
          + `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`);
      });
    },
  },
  {
    order: 62781,
    register() {
      registerSecretRole('secretlover', 'secretLover', 'Secret Lover');
    },
  },
  {
    order: 62848,
    register() {
      registerSecretRole('secretmommy', 'secretMommy', 'Secret Mommy');
    },
  },
  {
    order: 62915,
    register() {
      registerSecretRole('secretdaddy', 'secretDaddy', 'Secret Daddy');
    },
  },
  {
    order: 62984,
    register() {
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
    },
  }
  ];
};
