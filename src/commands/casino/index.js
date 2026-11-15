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
    order: 85328,
    register() {
      register(['coinflip', 'cf'], 'Bitcoin bei Kopf/Zahl setzen', async (ctx) => {
        const amount = parseAmount(ctx.args[0]);
        if (!amount) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}coinflip <Betrag>`);
        const account = user(ctx);
        if (account.bitcoin < amount) return ctx.reply('Du hast nicht genug Bitcoin.');
        const won = crypto.randomInt(0, 100) < 50 + Math.min((account.luck || 0) + (isVip(account) ? 10 : 0), 20);
        account.bitcoin += won ? amount : -amount;
        ctx.saveData();
        await ctx.reply(`${won ? '🪙 Kopf! Gewinn' : '🪙 Zahl! Verlust'}: ${amount} Bitcoin.\nKontostand: ${account.bitcoin}`);
      });
    },
  },
  {
    order: 85954,
    register() {
      register(['slots'], 'Slotmaschine spielen', async (ctx) => {
        const amount = parseAmount(ctx.args[0]);
        if (!amount) return ctx.reply(`Nutzung: ${commandPrefix(ctx)}slots <Betrag>`);
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
    },
  },
  {
    order: 87145,
    register() {
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
    },
  },
  {
    order: 87630,
    register() {
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
    },
  },
  {
    order: 88437,
    register() {
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
    },
  },
  {
    order: 89211,
    register() {
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
    },
  },
  {
    order: 89672,
    register() {
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
    },
  },
  {
    order: 90265,
    register() {
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
    },
  },
  {
    order: 90853,
    register() {
      register(['lottery'], 'Lotterie spielen', async (ctx) => {
        const amount = parseAmount(ctx.args[0]);
        const { account, error } = casinoBet(ctx, amount);
        if (error) return ctx.reply(error);
        const won = crypto.randomInt(0, 100) === 0;
        account.bitcoin += won ? amount * 50 : -amount;
        ctx.saveData();
        await ctx.reply(`🎟️ Lotterie: ${won ? `Jackpot! +${amount * 50}` : `Leider verloren: ${amount}`} Bitcoin.`);
      });
    },
  }
  ];
};
