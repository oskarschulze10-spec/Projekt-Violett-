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
    order: 64524,
    register() {
      register(['balance', 'bitcoin', 'coins'], 'Bitcoin-Guthaben anzeigen', async (ctx) => {
        await ctx.reply(`₿ Du hast ${user(ctx).bitcoin} Bitcoin im Violette-System.`);
      });
    },
  },
  {
    order: 64702,
    register() {
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
    },
  },
  {
    order: 65850,
    register() {
      timedRewardCommand('daily', 'lastDaily', 24 * 3600000, DAILY_REWARD, 'Daily');
    },
  },
  {
    order: 65930,
    register() {
      timedRewardCommand('weekly', 'lastWeekly', 7 * 24 * 3600000, WEEKLY_REWARD, 'Weekly');
    },
  },
  {
    order: 66020,
    register() {
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
    },
  },
  {
    order: 68049,
    register() {
      register(['shop'], 'Economy-Shop anzeigen', async (ctx) => {
        await ctx.reply(`🛒 VIOLETTE ECONOMY-SHOP\n\n${Object.entries(SHOP_ITEMS)
          .map(([name, item]) => `• ${name} — ${item.price} Bitcoin\n  ${item.description}`)
          .join('\n')}\n\nKaufen mit ${commandPrefix(ctx)}buy <item>`);
      });
    },
  },
  {
    order: 68350,
    register() {
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
    },
  },
  {
    order: 70208,
    register() {
      register(['bankkonto', 'bank'], 'Bankkonto eröffnen oder anzeigen', async (ctx) => {
        const account = user(ctx);
        if (!account.bankAccount) {
          const bankName = (ctx.args[0] || '').toLowerCase();
          if (!bankName) {
            return ctx.reply(`🏦 Banken:\n${Object.entries(BANKS).map(([name, bank]) => `• ${name} — Eröffnung ${bank.openingFee} Bitcoin, monatlich ${bank.monthlyFee} Bitcoin`).join('\n')}\n\nEröffnen mit ${commandPrefix(ctx)}bankkonto <Bank>`);
          }
          const bank = BANKS[bankName];
          if (!bank) return ctx.reply(`Diese Bank gibt es nicht. Nutze ${commandPrefix(ctx)}bankkonto für die Auswahl.`);
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
    },
  },
  {
    order: 71725,
    register() {
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
    },
  },
  {
    order: 72669,
    register() {
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
    },
  },
  {
    order: 73305,
    register() {
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
    },
  },
  {
    order: 73931,
    register() {
      register(['inventory'], 'Inventar und Economy-Vorteile anzeigen', async (ctx) => {
        const account = user(ctx);
        await ctx.reply(`🎒 Inventar: ${account.inventory.length ? account.inventory.join(', ') : 'leer'}\n⭐ VIP: ${isVip(account) ? 'aktiv' : 'inaktiv'}\n🍀 Glück: +${account.luck || 0}`);
      });
    },
  },
  {
    order: 74237,
    register() {
      register(['economy'], 'Economy-Übersicht anzeigen', async (ctx) => {
        const account = user(ctx);
        const deposits = account.deposits || [];
        await ctx.reply(`💼 Economy\n₿ Guthaben: ${account.bitcoin}\n🏦 Anlagen: ${deposits.length}\n🎒 Items: ${account.inventory.length}\nNutze ${commandPrefix(ctx)}deposit <Betrag> [Tage].`);
      });
    },
  },
  {
    order: 74578,
    register() {
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
    },
  },
  {
    order: 75604,
    register() {
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
    },
  },
  {
    order: 83761,
    register() {
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
    },
  },
  {
    order: 84409,
    register() {
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
    },
  }
  ];
};
