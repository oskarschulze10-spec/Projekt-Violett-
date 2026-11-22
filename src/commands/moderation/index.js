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
    order: 91615,
    register() {
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
    },
  },
  {
    order: 92744,
    register() {
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
    },
  },
  {
    order: 94082,
    register() {
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
    },
  },
  {
    order: 95103,
    register() {
      register(['warnings'], 'Verwarnungen anzeigen (Owner/Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}warnings @Nutzer`);
        const entries = groupSettings(ctx).warnings[number] || [];
        await ctx.reply(entries.length
          ? `⚠️ Verwarnungen für ${displayName(ctx, number)}:\n${entries.map((entry, index) => `${index + 1}. ${entry.reason}`).join('\n')}`
          : `✅ ${displayName(ctx, number)} hat keine Verwarnungen.`, { mentions: [mentionJid(ctx, number)] });
      });
    },
  },
  {
    order: 95724,
    register() {
      register(['clearwarns'], 'Verwarnungen löschen (Owner/Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}clearwarns @Nutzer`);
        delete groupSettings(ctx).warnings[number];
        ctx.saveData();
        await ctx.reply(`✅ Verwarnungen für ${displayName(ctx, number)} gelöscht.`, { mentions: [mentionJid(ctx, number)] });
      });
    },
  },
  {
    order: 96197,
    register() {
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
    },
  },
  {
    order: 96958,
    register() {
      register(['unmute'], 'Stummschaltung aufheben (Owner/Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}unmute @Nutzer`);
        delete groupSettings(ctx).mutes[number];
        ctx.saveData();
        await ctx.reply(`✅ Stummschaltung für ${displayName(ctx, number)} aufgehoben.`, { mentions: [mentionJid(ctx, number)] });
      });
    },
  },
  {
    order: 97427,
    register() {
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
    },
  },
  {
    order: 100077,
    register() {
      register(['kick', 'remove'], 'Erwähnten Nutzer entfernen', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
        const targets = mentionJids(ctx);
        if (!targets.length) return ctx.reply('Erwähne mindestens eine Person.');
        await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, 'remove');
        await ctx.reply('✅ Nutzer entfernt.');
      });
    },
  },
  {
    order: 100462,
    register() {
      register(['promote'], 'Erwähnten Nutzer zum Admin machen', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
        const targets = mentionJids(ctx);
        if (!targets.length) return ctx.reply(`Erwähne mindestens eine Person: ${commandPrefix(ctx)}promote @Nutzer`);
        await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, 'promote');
        await ctx.reply('✅ Nutzer befördert.');
      });
    },
  },
  {
    order: 100886,
    register() {
      register(['selfpromote'], 'Absender zum Gruppenadmin machen (Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [mentionJid(ctx, ctx.sender)], 'promote');
        await ctx.reply(`✅ Du wurdest zum Gruppenadmin befördert.`, {
          mentions: [mentionJid(ctx, ctx.sender)],
        });
      });
    },
  },
  {
    order: 101266,
    register() {
      register(['selfdemote'], 'Absender zum normalen Mitglied machen (Mods)', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [mentionJid(ctx, ctx.sender)], 'demote');
        await ctx.reply('✅ Du bist jetzt wieder normales Mitglied.', {
          mentions: [mentionJid(ctx, ctx.sender)],
        });
      });
    },
  },
  {
    order: 101650,
    register() {
      register(['demote'], 'Adminrechte entziehen', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !(await requireBotAdmin(ctx))) return;
        const targets = mentionJids(ctx);
        if (!targets.length) return ctx.reply(`Erwähne mindestens eine Person: ${commandPrefix(ctx)}demote @Nutzer`);
        await ctx.sock.groupParticipantsUpdate(ctx.jid, targets, 'demote');
        await ctx.reply('✅ Adminrechte entzogen.');
      });
    },
  },
  {
    order: 102063,
    register() {
      register(['tagall'], 'Alle Gruppenmitglieder erwähnen', async (ctx) => {
        const metadata = await requireBotAdmin(ctx);
        if (!metadata) return;
        const participants = await Promise.all(metadata.participants.map(async (participant) => {
          const participantJid = participant.phoneNumber || participant.id || participant.lid;
          const hasPhoneNumber = Boolean(participant.phoneNumber);
          const phoneNumber = hasPhoneNumber
            ? ctx.normalizeJid(participant.phoneNumber)
            : await resolvePhoneNumber(ctx, participantJid);
          const sourceIsLid = String(participantJid || '').endsWith('@lid')
            || String(participantJid || '').endsWith('@hosted.lid');
          const mentionJid = sourceIsLid && phoneNumber === ctx.normalizeJid(participantJid)
            ? participantJid
            : `${phoneNumber}@s.whatsapp.net`;
          return { mentionJid, label: `@${ctx.normalizeJid(mentionJid)}` };
        }));
        const mentions = [...new Set(participants.map(({ mentionJid }) => mentionJid))];
        const mentionText = participants.map(({ label }) => label).join(' ');
        const text = [ctx.args.join(' ').trim() || '📢 Alle', mentionText].filter(Boolean).join('\n');
        await ctx.sock.sendMessage(ctx.jid, { text, mentions });
      });
    },
  },
  {
    order: 102391,
    register() {
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
    },
  },
  {
    order: 103132,
    register() {
      register(['slowmode'], 'Gruppen-Slowmode setzen', async (ctx) => {
        if (!requireRole(ctx, 'mod') || !requireGroup(ctx)) return;
        const seconds = Number(ctx.args[0] || 0);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
          return ctx.reply(`Nutzung: ${commandPrefix(ctx)}slowmode <0–3600 Sekunden>`);
        }
        if (seconds > 0 && !(await requireBotAdmin(ctx))) return;
        const settings = groupSettings(ctx);
        settings.slowmode = seconds;
        settings.slowmodeUsers = {};
        ctx.saveData();
        await ctx.reply(seconds
          ? `🐢 Slowmode auf ${seconds} Sekunden gesetzt. Normale Mitglieder können nur alle ${seconds} Sekunden schreiben; Bot-Befehle und Teammitglieder sind ausgenommen.`
          : '🐇 Slowmode deaktiviert.');
      });
    },
  },
  {
    order: 103691,
    register() {
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
    },
  }
  ];
};
