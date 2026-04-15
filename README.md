# gogo-telegram-bot

Claude Code plugin that spawns an ephemeral Telegram bot backed by a Claude Agent SDK session. The bot inherits your full conversation context and can perform the same actions as Claude Code — from your phone.

## Install

One command:

```bash
npx gogo-telegram-bot-install
```

Or manually:

```bash
git clone https://github.com/saturnino-adrales/gogo-telegram-bot.git ~/.claude/skills/telegram-bot
cd ~/.claude/skills/telegram-bot/bot && npm install
```

## Setup

1. Get a bot token from [@BotFather](https://t.me/BotFather) on Telegram
2. Get your Telegram user ID from [@userinfobot](https://t.me/userinfobot)
3. Create `~/.claude/telegram-bot.yml`:

```yaml
telegram:
  bot_token: "YOUR_BOT_TOKEN"
  owner_id: YOUR_TELEGRAM_USER_ID
defaults:
  permission_level: readonly
  acl: []
```

## Usage

```
/gogo-telegram-bot:telegram              # Launch with default permissions
/gogo-telegram-bot:telegram --full       # Full access (read/write/bash/agents)
/gogo-telegram-bot:telegram --standard   # Read + edit + bash
/gogo-telegram-bot:telegram --readonly   # Read only (default)
/gogo-telegram-bot:telegram ps           # List running bots
/gogo-telegram-bot:telegram stop         # Stop all bots
/gogo-telegram-bot:telegram restart      # Restart with same permissions
/gogo-telegram-bot:telegram kill <PID>   # Kill specific bot
```

## Telegram Commands

| Command | Action |
|---------|--------|
| `/stop` | Shut down the bot |
| `/status` | Show permissions, uptime, working dir |
| `/perms` | List allowed tools |
| `/permlevel full` | Change permissions live |
| `/acl add <id>` | Add a user |
| `/acl remove <id>` | Remove a user |
| `/context` | Show injected context size |

## Features

- Full conversation context injected at startup
- Configurable permission levels (readonly / standard / full)
- Live permission changes via `/permlevel`
- ACL with owner-only default
- Real-time tool use streaming (shows which tools Claude is using)
- Intermediate text messages ("Let me check...")
- Telegram HTML formatting (bold, code, tables, links)
- Auto-compaction for long sessions
- Session persistence (remembers conversation within a session)
- Project-level config override

## How It Works

The plugin spawns a Node.js process that:
1. Creates a Telegraf bot connected to your Telegram bot token
2. Initializes a Claude Agent SDK session with your conversation context
3. Bridges messages: Telegram → SDK → Telegram
4. Shows tool use and intermediate responses in real-time
5. Dies when you send `/stop` or kill the process

## Config Layering

Priority: slash command args > project config > global config

- **Global**: `~/.claude/telegram-bot.yml`
- **Project**: `./telegram-bot.yml` (optional, overrides global)
- **Args**: `--full`, `--acl 123,456` (overrides everything)
