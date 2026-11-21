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
    resolvePhoneNumber,
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
    order: 46288,
    register() {
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
    },
  },
  {
    order: 50804,
    register() {
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
    },
  },
  {
    order: 104154,
    register() {
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
    },
  },
  {
    order: 105851,
    register() {
      register(['bc'], 'Broadcast an ausgewählte Gruppen (Owner/Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Broadcasts senden.');
        const text = ctx.args.join(' ').trim();
        if (!text) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}bc <Nachricht>`);
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
    },
  },
  {
    order: 107881,
    register() {
      register(['teamlist'], 'Teammitglieder anzeigen', async (ctx) => {
        const formatMember = async (value) => {
          const number = await resolvePhoneNumber(ctx, value);
          const name = displayUser(ctx, number);
          return name === number ? number : `${name} (${number})`;
        };
        const [owners, coOwners, mods, groupVictims, support] = await Promise.all([
          Promise.all(ctx.ownerNumbers.map(formatMember)),
          Promise.all((ctx.data.coOwners || []).map(formatMember)),
          Promise.all(ctx.data.mods.map(formatMember)),
          Promise.all((ctx.data.groupVictims || []).map(formatMember)),
          Promise.all(ctx.data.support.map(formatMember)),
        ]);
        await ctx.reply(`👥 Team\n👑 Owner: ${owners.join(', ')}\n💜 Co-Owners: ${coOwners.length ? coOwners.join(', ') : 'none'}\n🛡️ Mods: ${mods.length ? mods.join(', ') : 'keine'}\n🎭 GruppenOpfer (GO): ${groupVictims.length ? groupVictims.join(', ') : 'keine'}\n🆘 Support: ${support.length ? support.join(', ') : 'keiner'}`);
      });
    },
  },
  {
    order: 108308,
    register() {
      register(['modinfo'], 'Moderatorinformationen anzeigen', async (ctx) => {
        const requestedTarget = ctx.args.length ? targetNumber(ctx, ctx.args[0]) : ctx.normalizeJid(ctx.sender);
        if (!requestedTarget) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}modinfo [@Nutzer]`);
        const target = await resolvePhoneNumber(ctx, requestedTarget);
        const mods = await Promise.all(ctx.data.mods.map((number) => resolvePhoneNumber(ctx, number)));
        const groupVictims = await Promise.all((ctx.data.groupVictims || []).map((number) => resolvePhoneNumber(ctx, number)));
        const support = await Promise.all(ctx.data.support.map((number) => resolvePhoneNumber(ctx, number)));
        const coOwners = await Promise.all((ctx.data.coOwners || []).map((number) => resolvePhoneNumber(ctx, number)));
        await ctx.reply(`🛡️ ${displayName(ctx, target)}\nRolle: ${isOwner(ctx, target) ? 'Owner' : coOwners.includes(target) ? 'Co-Owner · Level 3' : groupVictims.includes(target) ? 'GruppenOpfer (GO)' : mods.includes(target) ? 'Moderator' : support.includes(target) ? 'Support' : 'Keine Teamrolle'}`);
      });
    },
  },
  {
    order: 108786,
    register() {
      register(['teamhelp'], 'Teamhilfe anzeigen', async (ctx) => {
        await ctx.reply(`👥 Teamhilfe\n${commandPrefix(ctx)}teamlist · Team anzeigen\n${commandPrefix(ctx)}modinfo [@Nutzer] · Rolle prüfen\n${commandPrefix(ctx)}suggest <Idee> · Befehlsidee einreichen\n${commandPrefix(ctx)}warn, ${commandPrefix(ctx)}mute, ${commandPrefix(ctx)}lock · Gruppenmoderation`);
      });
    },
  },
  {
    order: 109157,
    register() {
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
    },
  },
  {
    order: 109752,
    register() {
      register(['suggestions', 'ideas'], 'Offene Befehlsvorschläge anzeigen', async (ctx) => {
        ctx.data.suggestions ||= {};
        const entries = Object.values(ctx.data.suggestions).filter((entry) => entry.status === 'pending');
        if (!entries.length) return ctx.reply('💡 Es gibt aktuell keine offenen Befehlsvorschläge.');
        await ctx.reply(`💡 OFFENE VORSCHLÄGE\n\n${entries
          .map((entry) => `#${entry.id} — ${entry.text}\n   von @${displayUser(ctx, entry.author)}`)
          .join('\n\n')}`);
      });
    },
  },
  {
    order: 115465,
    register() {
      register(['join'], 'Bot-Beitritt anfordern', async (ctx) => {
        const link = ctx.args[0] || '';
        const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,24})/);
        if (!match) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}join https://chat.whatsapp.com/<Code>`);
        const id = String(ctx.data.nextRequestId++);
        ctx.data.joinRequests[id] = { id, link: match[1], requester: ctx.sender, createdAt: Date.now(), status: 'pending' };
        ctx.saveData();
        const recipientNumbers = await Promise.all(
          [...new Set([ctx.ownerNumber, ...ctx.data.mods, ...(ctx.data.groupVictims || []), ...ctx.data.support])]
            .map((number) => resolvePhoneNumber(ctx, number)),
        );
        const recipients = [...new Set(recipientNumbers)].map((number) => `${number}@s.whatsapp.net`);
        for (const recipient of recipients) await ctx.sock.sendMessage(recipient, {
          text: `🔔 Join-Anfrage #${id} von ${displayUser(ctx, ctx.sender)}\nMit ${commandPrefix(ctx)}approvejoin ${id} oder ${commandPrefix(ctx)}rejectjoin ${id} bearbeiten.`,
        });
        await ctx.reply(`✅ Anfrage #${id} wurde an Owner, Mods und Support gesendet.`);
      });
    },
  },
  {
    order: 116414,
    register() {
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
    },
  },
  {
    order: 117014,
    register() {
      register(['rejectjoin'], 'Join-Anfrage ablehnen (Owner/Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Join-Anfragen ablehnen.');
        const request = ctx.data.joinRequests[ctx.args[0]];
        if (!request || request.status !== 'pending') return ctx.reply('Anfrage nicht gefunden oder bereits bearbeitet.');
        request.status = 'rejected';
        ctx.saveData();
        await ctx.reply(`✅ Anfrage #${request.id} abgelehnt.`);
      });
    },
  }
  ];
};
