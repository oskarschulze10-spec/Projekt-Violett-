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
    order: 2260,
    register() {
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
    },
  },
  {
    order: 2718,
    register() {
      register(['spicyrate'], 'Spicy-Inhalt bewerten', async (ctx) => {
        if (!canUseSpicy(ctx)) return;
        const value = ctx.args.join(' ').trim();
        if (!value) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}spicyrate <Text>`);
        await ctx.reply(`🔞 "${value}" erhält ${crypto.randomInt(1, 101)}/100 Spicy-Level.`);
      });
    },
  },
  {
    order: 53359,
    register() {
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
    },
  },
  {
    order: 54803,
    register() {
      register(['spicy'], 'Spicy-Modus verwalten', async (ctx) => {
        const action = (ctx.args[0] || 'status').toLowerCase();
        ctx.data.spicyGroups ||= {};
        if (action === 'status') {
          return ctx.reply(ctx.isGroup
            ? `🌌 Spicy-Modus in dieser Gruppe: ${spicyEnabled(ctx) ? 'AKTIV' : 'AUS'}`
            : `🌌 Spicy-Befehle sind im Privatchat verfügbar, wenn du ${commandPrefix(ctx)}adult yes bestätigt hast.`);
        }
        if (!ctx.isGroup) return ctx.reply(`🌌 In Privatchats ist Spicy nicht separat schaltbar. Nutze ${commandPrefix(ctx)}adult yes oder ${commandPrefix(ctx)}adult no.`);
        if (!requireRole(ctx, 'mod')) return ctx.reply('Nur Owner und Moderatoren dürfen Spicy in Gruppen ändern.');
        if (!['on', 'off'].includes(action)) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}spicy on|off|status`);
        ctx.data.spicyGroups[ctx.jid] = action === 'on';
        ctx.saveData();
        await ctx.reply(`✅ Spicy-Modus ist in dieser Gruppe jetzt ${action === 'on' ? 'aktiviert' : 'deaktiviert'}.`);
      });
    },
  },
  {
    order: 79182,
    register() {
      register(['fuck'], 'Frecher Spaßbefehl', async (ctx) => {
        if (!canUseSpicy(ctx)) return;
        await runFunCommand(ctx, 'fuck', (target) => `🔞 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} und ${displayName(ctx, target)} verschwinden für einen privaten Moment …`);
      });
    },
  },
  {
    order: 82655,
    register() {
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
    },
  }
  ];
};
