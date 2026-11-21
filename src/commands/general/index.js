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
    order: 29763,
    register() {
      register(['ping'], 'Verbindung und Antwortzeit prüfen', async (ctx) => {
        await ctx.reply(`Pong! 🏓\n${ctx.responseDelayMs} ms`);
      });
    },
  },
  {
    order: 29901,
    register() {
      register(['help', 'menu'], 'Open the menu or explain a command', async (ctx) => {
        const requested = (ctx.args[0] || '').toLowerCase().replace(/^#/, '');
        if (!requested) return ctx.sendMenu();
        const command = commands.get(requested);
        if (!command) return ctx.reply('Unknown command: ' + requested + '. Use ' + commandPrefix(ctx) + 'commands.');
        await ctx.reply(
          '💜 COMMAND HELP\n'
          + 'Command: ' + commandPrefix(ctx) + command.names[0] + '\n'
          + 'Aliases: ' + command.names.map((name) => commandPrefix(ctx) + name).join(', ') + '\n'
          + 'Info: ' + command.description
        );
      }, { allowPrivate: true, allowUnregistered: true });
    },
  },
  {
    order: 29997,
    register() {
      register(['commands'], 'Alle registrierten Befehle anzeigen', async (ctx) => {
        const prefix = commandPrefix(ctx);
        const unique = [...new Set([...commands.values()])];
        await ctx.reply(`📚 REGISTRIERTE BEFEHLE\n\n${unique
          .map((command) => `${prefix}${command.names[0]} — ${command.description}`)
          .join('\n')}`);
      });
    },
  },
  {
    order: 30333,
    register() {
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
        await ctx.reply(`✅ Neuer Präfix: ${requested}`);
        await ctx.sendMenu();
      });
    },
  },
  {
    order: 48559,
    register() {
      for (const [number, menu] of Object.entries(MENU_CATEGORIES)) {
        register([`menu${number}`], `${menu.title} anzeigen`, async (ctx) => {
          if (number === '4' && !requireRole(ctx, 'mod')) {\n            return ctx.reply('This menu is only available to moderators and above.');\n          }\n          if (number === '7' && !isCurrentOwner(ctx)) {
            return ctx.reply('🔒 Dieses Owner-Menü ist ausschließlich für den Owner sichtbar.');
          }
          if (number === '8' && !isSpicyMenuVisible(ctx)) {
            return ctx.reply(`Dieses Menü ist nicht aktiviert. Ein Owner oder Mod muss zuerst ${commandPrefix(ctx)}spicy on nutzen.`);
          }
          return ctx.sendMenu(number);
        });
      }
    },
  },
  {
    order: 49084,
    register() {
      register(['say'], 'Text wiederholen', async (ctx) => ctx.reply(ctx.args.join(' ') || `Nutzung: ${commandPrefix(ctx)}say <Text>`));
    },
  }
  ];
};
