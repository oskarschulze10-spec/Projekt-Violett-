# Project Violette

WhatsApp bot built with Baileys. The bot runs through its separate `BOT_NUMBER`
account. Both `OWNER_NUMBER` and `BOT_NUMBER` have owner permissions; additional
owner numbers can be configured with `OWNER_NUMBERS`.

## Setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `OWNER_NUMBER` and `BOT_NUMBER` in international format without spaces. They must be different.
4. Run `npm start`.
5. Scan the QR code shown in the terminal using WhatsApp on the **bot account** under **Linked devices → Link a device**.

The authentication credentials are stored in `auth/bot-account/` and command
data in `data/bot-data.json`. Both locations are excluded from Git. Keep the
auth directory private; it grants access to the bot's WhatsApp account. If
WhatsApp logs out the bot account, only that dedicated auth directory is reset
and the bot reconnects to display a fresh QR code; command data is preserved.

The `#menu` command sends the Violette menu image with the category commands in
its caption. Open a category with commands such as `#menu1`; category menus are
sent as an image followed by the full text list. The bot additionally sends a
Baileys list-selection message for categories and a reply button to return to
the main menu. WhatsApp may not render these legacy interactive message types
in every client or group; use the text commands as a fallback. The bot only
processes incoming messages that begin with the configured command prefix;
other messages are ignored.

Command handlers are organized under `src/commands/` by menu category:
`account/`, `fun/`, `economy/`, `casino/`, `moderation/`, `team/`, `owner/`,
`spicy/`, and `general/`. The parent `index.js` keeps shared helpers and loads
the category modules in their original registration order, preserving aliases.

Run the smoke tests with `npm test`.
