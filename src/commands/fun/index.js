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
    order: 76571,
    register() {
      register(['joke'], 'Einen Witz erzählen', async (ctx) => {
        const jokes = ['Warum sind Entwickler schlechte Geheimnisträger? Sie teilen alles mit Git.', 'Was macht ein Byte im Urlaub? Es nimmt sich eine Auszeit.'];
        await ctx.reply(`😄 ${jokes[crypto.randomInt(jokes.length)]}`);
      });
    },
  },
  {
    order: 76863,
    register() {
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
    },
  },
  {
    order: 77686,
    register() {
      register(['8ball'], 'Magische 8-Ball-Antwort', async (ctx) => {
        if (!ctx.args.length) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}8ball <Frage>`);
        const answers = ['Ja, definitiv.', 'Sieht gut aus.', 'Frag später noch einmal.', 'Eher nicht.', 'Die Zeichen stehen auf Nein.'];
        await ctx.reply(`🎱 ${answers[crypto.randomInt(answers.length)]}`);
      });
    },
  },
  {
    order: 78051,
    register() {
      register(['rate'], 'Etwas spielerisch bewerten', async (ctx) => {
        const value = ctx.args.join(' ').trim();
        if (!value) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}rate <Text>`);
        await ctx.reply(`⭐ "${value}" bekommt ${crypto.randomInt(1, 101)}/100.`);
      });
    },
  },
  {
    order: 78324,
    register() {
      register(['hug'], 'Nutzer umarmen', async (ctx) => {
        await runFunCommand(ctx, 'hug', (target) => `🤗 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} umarmt ${displayName(ctx, target)}!`);
      });
    },
  },
  {
    order: 78525,
    register() {
      register(['kiss'], 'Nutzer küssen', async (ctx) => {
        await runFunCommand(ctx, 'kiss', (target) => `💋 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} küsst ${displayName(ctx, target)}!`);
      });
    },
  },
  {
    order: 78726,
    register() {
      register(['slap'], 'Nutzer spielerisch ohrfeigen', async (ctx) => {
        await runFunCommand(ctx, 'slap', (target) => `👋 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} gibt ${displayName(ctx, target)} einen spielerischen Klaps!`);
      });
    },
  },
  {
    order: 78967,
    register() {
      register(['pat'], 'Nutzer den Kopf tätscheln', async (ctx) => {
        await runFunCommand(ctx, 'pat', (target) => `🐾 ${displayName(ctx, ctx.normalizeJid(ctx.sender))} tätschelt ${displayName(ctx, target)}!`);
      });
    },
  },
  {
    order: 79460,
    register() {
      register(['aura'], 'Aura-Level anzeigen', async (ctx) => {
        const target = funTarget(ctx);
        const level = crypto.randomInt(1, 101);
        await runFunCommand(ctx, 'aura', () => `✨ Aura-Level von ${displayName(ctx, target)}: ${level}/100`);
      });
    },
  },
  {
    order: 79709,
    register() {
      register(['howgay'], 'Spielerischen Prozentwert anzeigen', async (ctx) => {
        const target = funTarget(ctx);
        const percentage = crypto.randomInt(0, 101);
        await runFunCommand(ctx, 'howgay', () => `🏳️‍🌈 Spaß-Wert für ${displayName(ctx, target)}: ${percentage}%`);
      });
    },
  },
  {
    order: 79988,
    register() {
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
    },
  },
  {
    order: 81927,
    register() {
      for (const [name, description, gif, template] of CUTE_FUN_COMMANDS) {
        register([name], description, async (ctx) => {
          await runFunCommand(ctx, gif, (target) => template
            .replace('{sender}', displayName(ctx, ctx.normalizeJid(ctx.sender)))
            .replace('{target}', displayName(ctx, target)));
        });
      }
    },
  }
  ];
};
