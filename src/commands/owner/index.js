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
    order: 31013,
    register() {
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
    },
  },
  {
    order: 33257,
    register() {
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
    },
  },
  {
    order: 35302,
    register() {
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
    },
  },
  {
    order: 35986,
    register() {
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
    },
  },
  {
    order: 39184,
    register() {
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
    },
  },
  {
    order: 41770,
    register() {
      register(['clone'], 'Aktuelle Gruppe mit denselben Mitgliedern kopieren (nur Owner/Admin)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Gruppen klonen.');
        const subject = ctx.args.join(' ').trim();
        if (!subject) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}clone <Name>`);
      
        const report = await cloneGroup(ctx, subject);
        if (report) await ctx.reply(report.summary);
      });
    },
  },
  {
    order: 42203,
    register() {
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
    },
  },
  {
    order: 42942,
    register() {
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
    },
  },
  {
    order: 47649,
    register() {
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
          ? `🔕 Bot in dieser Gruppe ausgeschaltet. Nur der Owner kann ihn mit ${commandPrefix(ctx)}groupignore off wieder aktivieren.`
          : '✅ Bot in dieser Gruppe wieder aktiviert.');
      });
    },
  },
  {
    order: 49947,
    register() {
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
    },
  },
  {
    order: 55807,
    register() {
      register(['tempban'], 'Nutzer zeitweise sperren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Nutzer bannen.');
        const number = targetNumber(ctx, ctx.args[0]);
        const minutes = Number(ctx.args.find((arg) => /^\d+$/.test(arg)));
        if (!number || !Number.isInteger(minutes) || minutes < 1 || minutes > 525600) {
          return ctx.reply(`Nutzung: ${commandPrefix(ctx)}tempban @Nutzer <Minuten> (max. 365 Tage)`);
        }
        if (isOwner(ctx, number)) return ctx.reply('Du kannst keinen Owner bannen.');
        ctx.data.bans[number] = { until: Date.now() + minutes * 60000, permanent: false, by: ctx.ownerNumber };
        ctx.saveData();
        await ctx.reply(`✅ Nutzer ${displayUser(ctx, number)} für ${minutes} Minuten gesperrt.`);
      });
    },
  },
  {
    order: 56590,
    register() {
      register(['ban'], 'Nutzer dauerhaft sperren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Nutzer bannen.');
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}ban @Nutzer oder ${commandPrefix(ctx)}ban <Nummer>`);
        if (isOwner(ctx, number)) return ctx.reply('Du kannst keinen Owner bannen.');
        ctx.data.bans[number] = { permanent: true, by: ctx.ownerNumber };
        ctx.saveData();
        await ctx.reply(`✅ Nutzer ${displayUser(ctx, number)} dauerhaft gesperrt.`);
      });
    },
  },
  {
    order: 57180,
    register() {
      register(['unban'], 'Nutzer-Bann aufheben (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Banns aufheben.');
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}unban @Nutzer oder ${commandPrefix(ctx)}unban <Nummer>`);
        delete ctx.data.bans[number];
        ctx.saveData();
        await ctx.reply(`✅ Bann für ${displayUser(ctx, number)} aufgehoben.`);
      });
    },
  },
  {
    order: 57650,
    register() {
      register(['block'], 'Private Nachrichten/Befehle blockieren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Privatchats blockieren.');
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number || isOwner(ctx, number)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}block <Nummer> oder ${commandPrefix(ctx)}block @Nutzer`);
        const jid = `${number}@s.whatsapp.net`;
        if (!ctx.data.blockedPrivateChats.includes(number)) ctx.data.blockedPrivateChats.push(number);
        ctx.saveData();
        await ctx.sock.updateBlockStatus(jid, 'block');
        await ctx.reply(`✅ Privatchat mit ${displayUser(ctx, number)} blockiert. Private Nachrichten und Befehle werden ignoriert; Gruppen bleiben unberührt.`);
      });
    },
  },
  {
    order: 58411,
    register() {
      register(['unblock'], 'Privatchat entsperren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Privatchats entsperren.');
        const number = targetNumber(ctx, ctx.args[0]);
        if (!number) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}unblock <Nummer> oder ${commandPrefix(ctx)}unblock @Nutzer`);
        ctx.data.blockedPrivateChats = ctx.data.blockedPrivateChats.filter((entry) => entry !== number);
        ctx.saveData();
        await ctx.sock.updateBlockStatus(`${number}@s.whatsapp.net`, 'unblock');
        await ctx.reply(`✅ Privatchat mit ${displayUser(ctx, number)} entsperrt.`);
      });
    },
  },
  {
    order: 83186,
    register() {
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
    },
  },
  {
    order: 98113,
    register() {
      register(['addmod'], 'Moderator ernennen (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Moderatoren ernennen.');
        const target = mentionJids(ctx)[0];
        if (!target) return ctx.reply(`Erwähne die Person: ${commandPrefix(ctx)}addmod @Nutzer`);
        const number = ctx.normalizeJid(target);
        if (!ctx.data.mods.includes(number)) ctx.data.mods.push(number);
        ctx.saveData();
        await ctx.reply('✅ Moderator hinzugefügt.');
      });
    },
  },
  {
    order: 98601,
    register() {
      register(['delmod'], 'Moderator entfernen (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Moderatoren entfernen.');
        const target = mentionJids(ctx)[0];
        if (!target) return ctx.reply(`Erwähne die Person: ${commandPrefix(ctx)}delmod @Nutzer`);
        const number = ctx.normalizeJid(target);
        ctx.data.mods = ctx.data.mods.filter((mod) => mod !== number);
        ctx.saveData();
        await ctx.reply('✅ Moderator entfernt.');
      });
    },
  },
  {
    order: 99086,
    register() {
      register(['addsupport'], 'Support ernennen (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Support ernennen.');
        const target = mentionJids(ctx)[0];
        if (!target) return ctx.reply(`Erwähne die Person: ${commandPrefix(ctx)}addsupport @Nutzer`);
        const number = ctx.normalizeJid(target);
        if (!ctx.data.support.includes(number)) ctx.data.support.push(number);
        ctx.saveData();
        await ctx.reply('✅ Support hinzugefügt.');
      });
    },
  },
  {
    order: 99580,
    register() {
      register(['delsupport'], 'Support entfernen (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Support entfernen.');
        const target = mentionJids(ctx)[0];
        if (!target) return ctx.reply(`Erwähne die Person: ${commandPrefix(ctx)}delsupport @Nutzer`);
        const number = ctx.normalizeJid(target);
        ctx.data.support = ctx.data.support.filter((person) => person !== number);
        ctx.saveData();
        await ctx.reply('✅ Support entfernt.');
      });
    },
  },
  {
    order: 110253,
    register() {
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
    },
  },
  {
    order: 111140,
    register() {
      register(['botstats'], 'Bot-Statistiken anzeigen', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Bot-Statistiken anzeigen.');
        const groups = ctx.sock.groupFetchAllParticipating ? await ctx.sock.groupFetchAllParticipating() : {};
        await ctx.reply(`📊 Botstats\nNutzer: ${Object.keys(ctx.data.users).length}\nGruppen: ${Object.keys(groups).length}\nBefehle: ${new Set(commands.values()).size}`);
      });
    },
  },
  {
    order: 111590,
    register() {
      register(['reload'], 'Botdaten neu laden', async (ctx) => {
        if (!requireRole(ctx, 'owner')) return ctx.reply('Nur der Owner darf Daten neu laden.');
        await ctx.reply('♻️ Die aktuelle Datendatei wird bei jedem Befehl konsistent gespeichert. Ein Prozessneustart ist nicht erforderlich.');
      });
    },
  },
  {
    order: 111890,
    register() {
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
    },
  },
  {
    order: 112503,
    register() {
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
    },
  },
  {
    order: 113822,
    register() {
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
    },
  }
  ];
};
