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
      register(['register'], 'Namen für die Bot-Nutzung registrieren', async (ctx) => {
        if (ctx.isGroup) return ctx.reply(`🔒 Registrierung ist nur im Privatchat möglich. Nutze dort ${commandPrefix(ctx)}register <Name>.`);
        if (!user(ctx).privacyAccepted) {
          return ctx.reply(`🔒 Aktiviere zuerst die Nutzungsbedingungen mit ${commandPrefix(ctx)}dsgvo akzeptieren.`);
        }
        const name = ctx.args.join(' ').trim();
        if (!name || name.length < 2 || name.length > 40) {
          return ctx.reply(`Nutzung: ${commandPrefix(ctx)}register <Name> (2 bis 40 Zeichen)`);
        }
        const account = user(ctx);
        account.displayName = name;
        ctx.saveData();
        await ctx.reply(`✅ Danke, ${name}. Dein Account ist registriert.`);
      });
    },
  },
  {
    order: 52247,
    register() {
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
            `Wenn du einverstanden bist, nutze: ${commandPrefix(ctx)}dsgvo akzeptieren`,
          );
          return;
        }
        account.privacyAccepted = true;
        account.privacyAcceptedAt = new Date().toISOString();
        ctx.saveData();
        await ctx.reply('✅ Datenschutz akzeptiert. Du kannst den Bot jetzt nutzen.');
      });
    },
  },
  {
    order: 59460,
    register() {
      register(['profile'], 'Eigenes PV-Profil anzeigen', async (ctx) => {
        const account = user(ctx);
        await ctx.reply(\`👤 \${account.displayName || 'Unregistriert'}\n₿ Bitcoin: \${account.bitcoin}\n⭐ VIP: \${isVip(account) ? 'aktiv' : 'inaktiv'}\`);
      });
      register(['pb'], 'WhatsApp-Profilbild und öffentliche Profildaten einer Nummer anzeigen', async (ctx) => {
        const rawNumber = ctx.args.join('').replace(/[^\d]/g, '');
        if (!rawNumber || rawNumber.length < 7 || rawNumber.length > 15) {
          return ctx.reply(\`Nutzung: \${commandPrefix(ctx)}pb <Ländervorwahl + Nummer>\nBeispiel: \${commandPrefix(ctx)}pb 491701234567\`);
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
          return ctx.reply(\`🔎 Nummer: +\${rawNumber}\n📱 Bei WhatsApp registriert: Nein\n🖼️ Profilbild: nicht verfügbar\`);
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
          \`📞 Nummer: +\${rawNumber}\`,
          '📱 Bei WhatsApp registriert: Ja',
          \`📝 Info/Status: \${statusText}\`,
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
        await ctx.reply(\`\${caption}\n🖼️ Profilbild: Nicht sichtbar oder nicht freigegeben.\`);
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
      register(['privacy'], 'Datenschutzstatus anzeigen', async (ctx) => {
        const account = user(ctx);
        await ctx.reply(`🔐 Datenschutz: ${account.privacyAccepted ? 'akzeptiert' : 'nicht akzeptiert'}\nGespeichert werden nur Bot-Daten lokal. Löschen mit ${commandPrefix(ctx)}deleteaccount.`);
      });
    },
  },
  {
    order: 60399,
    register() {
      register(['deleteaccount'], 'Eigene Accountdaten löschen', async (ctx) => {
        const id = ctx.normalizeJid(ctx.sender);
        if (!ctx.data.users[id]) return ctx.reply('Für dich sind keine Accountdaten gespeichert.');
        delete ctx.data.users[id];
        ctx.saveData();
        await ctx.reply('✅ Deine eigenen Accountdaten wurden gelöscht. Für eine erneute Nutzung musst du dich neu registrieren.');
      });
    },
  },
  {
    order: 60797,
    register() {
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
