'use strict';

module.exports = (runtime) => {
  const {
    register, requireRole, isOwner, mentionJids, resolvePhoneNumber,
    displayUser, commandPrefix,
  } = runtime;

  const isTeam = (ctx) => requireRole(ctx, 'support');
  const staffMenu = async (ctx, title, lines) => {
    await ctx.reply([
      '╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮',
      '       💜 PROJECT VIOLETTÉ',
      '          ' + title,
      '╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
      '',
      ...lines.map((line) => '  ◈ ' + commandPrefix(ctx) + line),
      '',
      '  DESIGN BY 7 · NEXUS V8',
    ].join('\n'));
  };

  async function targetIdentifiers(ctx, raw) {
    const mention = mentionJids(ctx)[0];
    const value = mention || raw || '';
    const jid = String(value).includes('@')
      ? value
      : (String(value).replace(/\D/g, '') + '@s.whatsapp.net');
    const phone = await resolvePhoneNumber(ctx, jid);
    return [...new Set([ctx.normalizeJid(jid), ctx.normalizeJid(phone)].filter(Boolean))];
  }

  function removeAccountEverywhere(ctx, identifiers) {
    const matches = new Set(identifiers);
    const users = ctx.data.users || {};
    for (const [id, account] of Object.entries(users)) {
      const accountIds = [
        id, account?.phoneNumber, account?.lid,
        ...(Array.isArray(account?.lids) ? account.lids : []),
      ].map((value) => ctx.normalizeJid(value)).filter(Boolean);
      if (accountIds.some((value) => matches.has(value))) {
        matches.add(ctx.normalizeJid(id));
        delete users[id];
      }
    }
    const aliases = ctx.data.userAliases || {};
    for (const [alias, canonical] of Object.entries(aliases)) {
      if (matches.has(ctx.normalizeJid(alias)) || matches.has(ctx.normalizeJid(canonical))) {
        matches.add(ctx.normalizeJid(alias));
        matches.add(ctx.normalizeJid(canonical));
        delete aliases[alias];
      }
    }
    for (const field of ['mods', 'support', 'coOwners', 'groupVictims', 'blockedPrivateChats', 'ignoredBots']) {
      ctx.data[field] = (ctx.data[field] || []).filter((entry) => !matches.has(ctx.normalizeJid(entry)));
    }
    for (const field of ['userTodos', 'bans']) {
      for (const key of Object.keys(ctx.data[field] || {})) {
        if (matches.has(ctx.normalizeJid(key))) delete ctx.data[field][key];
      }
    }
    for (const settings of Object.values(ctx.data.groupSettings || {})) {
      for (const field of ['warnings', 'mutes']) {
        for (const key of Object.keys(settings?.[field] || {})) {
          if (matches.has(ctx.normalizeJid(key))) delete settings[field][key];
        }
      }
    }
  }

  return [
    {
      order: 118000,
      register() {
        register(['join'], 'Request that Violette joins a WhatsApp group', async (ctx) => {
          if (ctx.isGroup) return ctx.reply('Please send #join in a private chat.');
          const link = ctx.args[0] || '';
          const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,24})/);
          if (!match) return ctx.reply('Usage: ' + commandPrefix(ctx) + 'join <WhatsApp group invite link>');
          const targetGroup = ctx.data.settings?.joinGroup;
          if (!targetGroup) return ctx.reply('Join requests are currently unavailable. Please contact the bot owner.');
          let groupName = 'Unknown group';
          try {
            if (typeof ctx.sock.groupGetInviteInfo === 'function') {
              const info = await ctx.sock.groupGetInviteInfo(match[1]);
              groupName = info?.subject || groupName;
            }
          } catch (error) {
            console.error('Could not read join invite information:', error.message);
          }
          const id = String(ctx.data.nextRequestId++);
          const requester = ctx.phoneNumber || ctx.normalizeJid(ctx.sender);
          ctx.data.joinRequests ||= {};
          ctx.data.joinRequests[id] = {
            id, inviteCode: match[1], inviteLink: 'https://chat.whatsapp.com/' + match[1],
            groupName, requester, requesterName: ctx.data.users?.[requester]?.displayName || 'Unknown',
            createdAt: Date.now(), status: 'pending',
          };
          ctx.saveData();
          await ctx.sock.sendMessage(targetGroup, {
            text: [
              '╭─ 💜 VIOLETTÉ JOIN REQUEST',
              '│ Request: #' + id,
              '│ User: ' + (ctx.data.users?.[requester]?.displayName || 'Unknown'),
              '│ Number: +' + requester,
              '│ Group: ' + groupName,
              '│ Invite: https://chat.whatsapp.com/' + match[1],
              '│',
              '│ Accept: #approvejoin ' + id,
              '│ Reject: #rejectjoin ' + id,
              '╰─ DESIGN BY 7',
            ].join('\n'),
          });
          await ctx.reply('Your join request #' + id + ' has been sent to the team.');
        }, { privateOnly: true, allowUnregistered: true });
      },
    },
    {
      order: 118100,
      register() {
        register(['approvejoin'], 'Accept a pending join request', async (ctx) => {
          if (!requireRole(ctx, 'mod')) return ctx.reply('This action is for moderators and above.');
          const request = ctx.data.joinRequests?.[ctx.args[0]];
          if (!request || request.status !== 'pending') return ctx.reply('Request not found or already handled.');
          const groupJid = await ctx.sock.groupAcceptInvite(request.inviteCode);
          request.status = 'accepted';
          request.groupJid = groupJid;
          request.handledBy = ctx.normalizeJid(ctx.sender);
          request.handledAt = Date.now();
          ctx.saveData();
          await ctx.reply('Join request #' + request.id + ' accepted.');
          if (request.requester) {
            await ctx.sock.sendMessage(request.requester + '@s.whatsapp.net', {
              text: 'Your request to join Violette group "' + request.groupName + '" was accepted.',
            }).catch(() => {});
          }
        });
      },
    },
    {
      order: 118200,
      register() {
        register(['rejectjoin'], 'Reject a pending join request', async (ctx) => {
          if (!requireRole(ctx, 'mod')) return ctx.reply('This action is for moderators and above.');
          const request = ctx.data.joinRequests?.[ctx.args[0]];
          if (!request || request.status !== 'pending') return ctx.reply('Request not found or already handled.');
          request.status = 'rejected';
          request.handledBy = ctx.normalizeJid(ctx.sender);
          request.handledAt = Date.now();
          ctx.saveData();
          await ctx.reply('Join request #' + request.id + ' rejected.');
          if (request.requester) {
            await ctx.sock.sendMessage(request.requester + '@s.whatsapp.net', {
              text: 'Your request to join Violette group "' + request.groupName + '" was rejected.',
            }).catch(() => {});
          }
        });
      },
    },
    {
      order: 116300,
      register() {
        register(['support'], 'Send a support ticket to the Violette team', async (ctx) => {
          if (ctx.isGroup) return ctx.reply('Please send #support in a private chat.');
          const message = ctx.args.join(' ').trim();
          if (!message) return ctx.reply('Usage: ' + commandPrefix(ctx) + 'support <describe your problem>');
          const targetGroup = ctx.data.settings?.supportGroup;
          if (!targetGroup) return ctx.reply('Support is currently unavailable. Please contact the bot owner.');
          const id = String(ctx.data.nextSupportId++);
          const requester = ctx.phoneNumber || ctx.normalizeJid(ctx.sender);
          const account = ctx.data.users?.[requester] || {};
          ctx.data.supportTickets ||= {};
          ctx.data.supportTickets[id] = {
            id, requester, requesterName: account.displayName || 'Unknown',
            message, createdAt: Date.now(), status: 'open',
          };
          ctx.saveData();
          await ctx.sock.sendMessage(targetGroup, {
            text: [
              '╭─ 🎧 VIOLETTÉ SUPPORT TICKET',
              '│ Ticket: #' + id,
              '│ User: ' + (account.displayName || 'Unknown'),
              '│ Number: +' + requester,
              '│ Message: ' + message,
              '│',
              '│ Reply: #supportreply ' + id + ' <message>',
              '│ Close: #supportclose ' + id,
              '╰─ DESIGN BY 7',
            ].join('\n'),
          });
          await ctx.reply('Support ticket #' + id + ' has been sent. The team will reply here.');
        }, { privateOnly: true, allowUnregistered: true });
      },
    },
    {
      order: 116400,
      register() {
        register(['supportreply'], 'Reply to a support ticket', async (ctx) => {
          if (!isTeam(ctx)) return ctx.reply('This action is for support staff and above.');
          if (!ctx.isGroup || ctx.jid !== ctx.data.settings?.supportGroup) {
            return ctx.reply('Use this command in the configured support group.');
          }
          const id = ctx.args[0];
          const message = ctx.args.slice(1).join(' ').trim();
          const ticket = ctx.data.supportTickets?.[id];
          if (!ticket || ticket.status !== 'open') return ctx.reply('Open ticket not found.');
          if (!message) return ctx.reply('Usage: #supportreply <ticket ID> <message>');
          await ctx.sock.sendMessage(ticket.requester + '@s.whatsapp.net', {
            text: '💜 Violette Support · Ticket #' + id + '\n\n' + message,
          });
          ticket.lastReplyAt = Date.now();
          ticket.lastReplyBy = ctx.normalizeJid(ctx.sender);
          ctx.saveData();
          await ctx.reply('Reply sent to ticket #' + id + '.');
        });
      },
    },
    {
      order: 116500,
      register() {
        register(['supportclose'], 'Close a support ticket', async (ctx) => {
          if (!isTeam(ctx)) return ctx.reply('This action is for support staff and above.');
          if (!ctx.isGroup || ctx.jid !== ctx.data.settings?.supportGroup) {
            return ctx.reply('Use this command in the configured support group.');
          }
          const ticket = ctx.data.supportTickets?.[ctx.args[0]];
          if (!ticket || ticket.status !== 'open') return ctx.reply('Open ticket not found.');
          ticket.status = 'closed';
          ticket.closedAt = Date.now();
          ticket.closedBy = ctx.normalizeJid(ctx.sender);
          ctx.saveData();
          await ctx.reply('Ticket #' + ticket.id + ' closed.');
          await ctx.sock.sendMessage(ticket.requester + '@s.whatsapp.net', {
            text: 'Your Violette support ticket #' + ticket.id + ' has been closed.',
          }).catch(() => {});
        });
      },
    },
    {
      order: 116600,
      register() {
        register(['setjoingroup'], 'Set the group that receives join requests', async (ctx) => {
          if (!requireRole(ctx, 'coowner')) return ctx.reply('Only the co-owner and owner can configure the join request group.');
          const target = ctx.isGroup ? ctx.jid : (ctx.args[0] || '');
          if (!target.endsWith('@g.us')) return ctx.reply('Run this command inside the target group or provide its group ID.');
          ctx.data.settings.joinGroup = target;
          ctx.saveData();
          await ctx.reply('Join request group saved.');
        });
      },
    },
    {
      order: 116700,
      register() {
        register(['setsupportgroup'], 'Set the group that receives support tickets', async (ctx) => {
          if (!requireRole(ctx, 'coowner')) return ctx.reply('Only the co-owner and owner can configure the support group.');
          const target = ctx.isGroup ? ctx.jid : (ctx.args[0] || '');
          if (!target.endsWith('@g.us')) return ctx.reply('Run this command inside the target group or provide its group ID.');
          ctx.data.settings.supportGroup = target;
          ctx.saveData();
          await ctx.reply('Support group saved.');
        });
      },
    },
    {
      order: 116800,
      register() {
        register(['removeaccount'], 'Permanently remove a user account and its stored data', async (ctx) => {
          if (!requireRole(ctx, 'owner')) return ctx.reply('Only the owner can remove accounts.');
          if ((ctx.args[0] || '').toLowerCase() !== 'confirm') {
            return ctx.reply('Usage: #removeaccount confirm @user or #removeaccount confirm <phone number>. This permanently deletes the account.');
          }
          const mention = mentionJids(ctx)[0];
          const raw = ctx.args.find((arg) => /\d{7,15}/.test(arg));
          const target = mention || raw;
          if (!target) return ctx.reply('Mention a user or provide their international phone number.');
          const identifiers = await targetIdentifiers(ctx, target);
          if (ctx.ownerNumbers?.some((owner) => identifiers.includes(ctx.normalizeJid(owner)))) {
            return ctx.reply('The bot owner account is protected.');
          }
          const exists = Object.entries(ctx.data.users || {}).some(([id, account]) => [
            id, account?.phoneNumber, account?.lid, ...(account?.lids || []),
          ].some((value) => identifiers.includes(ctx.normalizeJid(value))));
          if (!exists) return ctx.reply('No stored account was found for that user.');
          removeAccountEverywhere(ctx, identifiers);
          ctx.saveData();
          await ctx.reply('Account permanently removed. All stored profile, wallet, ranking and staff data for this user was deleted. They must accept the current privacy notice and register again.');
        });
      },
    },
    {
      order: 116900,
      register() {
        register(['addcoowner'], 'Promote a user to co-owner (owner only)', async (ctx) => {
          if (!requireRole(ctx, 'owner')) return ctx.reply('Only the owner can appoint co-owners.');
          const target = mentionJids(ctx)[0];
          if (!target) return ctx.reply('Usage: #addcoowner @user');
          const ids = await targetIdentifiers(ctx, target);
          if (ctx.ownerNumbers?.some((owner) => ids.includes(ctx.normalizeJid(owner)))) return ctx.reply('The owner already has the highest rank.');
          ctx.data.coOwners ||= [];
          const number = ids[1] || ids[0];
          if (!ctx.data.coOwners.some((entry) => ids.includes(ctx.normalizeJid(entry)))) ctx.data.coOwners.push(number);
          ctx.data.mods = (ctx.data.mods || []).filter((entry) => !ids.includes(ctx.normalizeJid(entry)));
          ctx.data.support = (ctx.data.support || []).filter((entry) => !ids.includes(ctx.normalizeJid(entry)));
          ctx.saveData();
          await ctx.reply('Co-Owner rank assigned (Level 3).');
        });
      },
    },
    {
      order: 117000,
      register() {
        register(['delcoowner'], 'Remove a co-owner rank (owner only)', async (ctx) => {
          if (!requireRole(ctx, 'owner')) return ctx.reply('Only the owner can manage co-owners.');
          const target = mentionJids(ctx)[0];
          if (!target) return ctx.reply('Usage: #delcoowner @user');
          const ids = await targetIdentifiers(ctx, target);
          ctx.data.coOwners = (ctx.data.coOwners || []).filter((entry) => !ids.includes(ctx.normalizeJid(entry)));
          ctx.saveData();
          await ctx.reply('Co-Owner rank removed.');
        });
      },
    },
    {
      order: 117100,
      register() {
        register(['alliance'], 'Manage Violette alliance partner groups', async (ctx) => {
          ctx.data.alliancePartners ||= [];
          const action = (ctx.args[0] || 'list').toLowerCase();
          if (action === 'list') {
            if (!ctx.data.alliancePartners.length) return ctx.reply('No alliance partners configured.');
            return ctx.reply('💜 ALLIANCE PARTNERS\n' + ctx.data.alliancePartners.map((entry, i) =>
              (i + 1) + '. ' + entry.name + '\n' + (entry.inviteLink || entry.jid)).join('\n\n'));
          }
          if (!requireRole(ctx, 'coowner')) return ctx.reply('Only the co-owner and owner can manage alliance partners.');
          if (!['add', 'remove'].includes(action) || !ctx.isGroup) {
            return ctx.reply('Usage: #alliance add [name] or #alliance remove (run inside the partner group).');
          }
          if (action === 'add') {
            const metadata = await ctx.sock.groupMetadata(ctx.jid);
            let inviteLink = '';
            try {
              if (typeof ctx.sock.groupInviteCode === 'function') {
                inviteLink = 'https://chat.whatsapp.com/' + await ctx.sock.groupInviteCode(ctx.jid);
              }
            } catch (error) {
              console.error('Could not create alliance invite link:', error.message);
            }
            ctx.data.alliancePartners = ctx.data.alliancePartners.filter((entry) => entry.jid !== ctx.jid);
            ctx.data.alliancePartners.push({
              jid: ctx.jid, name: ctx.args.slice(1).join(' ').trim() || metadata.subject || 'Alliance partner',
              inviteLink, addedAt: Date.now(),
            });
            ctx.saveData();
            return ctx.reply('Alliance partner added.');
          }
          ctx.data.alliancePartners = ctx.data.alliancePartners.filter((entry) => entry.jid !== ctx.jid);
          ctx.saveData();
          await ctx.reply('Alliance partner removed.');
        });
      },
    },
    {
      order: 117200,
      register() {
        register(['community'], 'Show Violette community statistics and alliance partners', async (ctx) => {
          const users = Object.values(ctx.data.users || {}).filter((account) =>
            account?.privacyAccepted && account?.registeredAt);
          let groups = {};
          try {
            groups = ctx.sock.groupFetchAllParticipating ? await ctx.sock.groupFetchAllParticipating() : {};
          } catch (error) {
            console.error('Could not fetch group list:', error.message);
          }
          const createdAt = Number(ctx.data.settings?.botCreatedAt) || Date.now();
          const days = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
          const partners = (ctx.data.alliancePartners || []).map((entry) =>
            '• ' + entry.name + '\n  ' + (entry.inviteLink || entry.jid));
          await ctx.reply([
            '╭━━ 💜 VIOLETTÉ COMMUNITY ━━╮',
            'Registered users: ' + users.length,
            'Bot online since: ' + new Date(createdAt).toLocaleDateString('en-GB'),
            'Days since launch: ' + days,
            'Connected groups: ' + Object.keys(groups).length,
            'Alliance partners: ' + (ctx.data.alliancePartners || []).length,
            '',
            'ALLIANCE PARTNERS',
            ...(partners.length ? partners : ['No partners configured yet.']),
            '╰━━━━━━━━━━━━━━━━━━━━━━━━╯',
          ].join('\n'));
        });
      },
    },
    {
      order: 117300,
      register() {
        register(['staffrank'], 'Show Violette staff ranks', async (ctx) => {
          const id = ctx.normalizeJid(ctx.sender);
          const has = (list) => (list || []).some((entry) => ctx.normalizeJid(entry) === id);
          const rank = isOwner(ctx, id) ? 'Owner'
            : has(ctx.data.coOwners) ? 'Co-Owner · Level 3'
              : has(ctx.data.mods) || has(ctx.data.groupVictims) ? 'Moderator · Level 2'
                : has(ctx.data.support) ? 'Supporter · Level 1' : 'Member';
          await ctx.reply('💜 VIOLETTÉ STAFF RANK\n' + rank);
        });
      },
    },
    {
      order: 117400,
      register() {
        register(['modmenu'], 'Open the moderator menu', async (ctx) => {
          if (!requireRole(ctx, 'mod')) return ctx.reply('This menu is for moderators and above.');
          await staffMenu(ctx, 'MODERATOR MENU', [
            'warn', 'warnings', 'clearwarns', 'mute', 'unmute', 'kick',
            'antilink', 'antisticker', 'lock', 'slowmode', 'tagall',
            'approvejoin', 'rejectjoin', 'teamlist', 'modinfo',
          ]);
        });
      },
    },
    {
      order: 117500,
      register() {
        register(['supportmenu'], 'Open the support menu', async (ctx) => {
          if (!requireRole(ctx, 'support')) return ctx.reply('This menu is for support staff and above.');
          await staffMenu(ctx, 'SUPPORT MENU', [
            'supportreply', 'supportclose', 'teamlist', 'modinfo', 'teamhelp',
          ]);
        });
      },
    },
    {
      order: 117600,
      register() {
        register(['coownermenu'], 'Open the co-owner menu', async (ctx) => {
          if (!requireRole(ctx, 'coowner')) return ctx.reply('This menu is for co-owners and the owner.');
          await staffMenu(ctx, 'CO-OWNER MENU', [
            'modmenu', 'supportmenu', 'community', 'alliance', 'bc', 'approvejoin',
            'rejectjoin', 'setjoingroup', 'setsupportgroup',
          ]);
        });
      },
    },
    {
      order: 117700,
      register() {
        register(['ownermenu'], 'Open the owner menu', async (ctx) => {
          if (!requireRole(ctx, 'owner')) return ctx.reply('This menu is only available to the owner.');
          await staffMenu(ctx, 'OWNER CONTROL', [
            'addcoowner', 'delcoowner', 'addmod', 'delmod', 'addsupport', 'delsupport',
            'removeaccount', 'setjoingroup', 'setsupportgroup', 'alliance', 'botstats',
            'prefix', 'setdesign', 'resetdesign', 'maintenance', 'reload',
          ]);
        });
      },
    },
  ];
};
