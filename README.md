# gogo-telegram-bot

Claude Code plugin that spawns an ephemeral Telegram bot backed by a Claude Agent SDK session. The bot inherits your full conversation context and can perform the same actions as Claude Code — from your phone.

## Install

One command:

```bash
npx gogo-telegram-bot
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
/telegram-bot                # Launch with default permissions
/telegram-bot --full         # Full access (read/write/bash/agents)
/telegram-bot --standard     # Read + edit + bash
/telegram-bot --readonly     # Read only (default)
/telegram-bot ps             # List running bots
/telegram-bot stop           # Stop all bots
/telegram-bot restart        # Restart with same permissions
/telegram-bot kill <PID>     # Kill specific bot
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
| `/reset` | Clear the current SDK session and start fresh |

## Features

- Full conversation context injected at startup
- Configurable permission levels (readonly / standard / full)
- Live permission changes via `/permlevel`
- ACL with owner-only default
- Real-time tool use streaming (shows which tools Claude is using)
- Intermediate text messages ("Let me check...")
- Telegram HTML formatting (bold, code, tables, links)
- Image and file attachment support (photos, documents, audio, video, stickers)
- Auto-rotate session on context-limit errors (recovers without restart)
- Manual session reset via `/reset`
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

## Changelog

### 1.0.12 — Better tool labels
- `Agent` / `Task` tool entries now show the subagent's `description` (or `subagent_type`) — parallel agents no longer look identical
- `ToolSearch` and WebFetch-style tools show their `query` / `url`

### 1.0.11 — Stream intermediate text live
- Intermediate thinking messages now stream to Telegram as Claude produces them, instead of being buffered and dumped after the SDK finishes
- Final result is only sent if it wasn't already streamed as an intermediate (no duplicate)

### 1.0.10 — No more silent death on long runs
- Disabled Telegraf's 90s `handlerTimeout` (set to `Infinity`) so long-running SDK / Agent calls aren't aborted mid-flight
- Added `bot.catch` to surface Telegraf middleware errors
- `unhandledRejection` and `uncaughtException` now DM the owner a formatted error (stack trace included) in addition to logging

### 1.0.9 — Session resilience
- Added `/reset` Telegram command to clear the current SDK session
- Auto-rotate session on context-limit errors (one-shot retry with fresh session)
- `unhandledRejection` / `uncaughtException` are logged instead of killing the bot

### 1.0.8 — PID state file
- Bot writes `/tmp/gogo-telegram-bot.state.json` on startup and on `/permlevel` / `/acl` changes
- `/telegram ps|kill|stop|restart` use `kill -0 <pid>` liveness probe (no `ps aux`)
- State file removed on clean shutdown; stale files auto-cleaned on discovery

### 1.0.7 — Attachments
- Download and pass Telegram attachments (photo, document, video, audio, voice, video_note, animation, sticker) to Claude via absolute file paths
- Files saved under `<cwd>/.telegram-uploads/`
- Accepts text, caption, or attachment-only messages

### 1.0.6 — Process control fix
- `/telegram stop` uses `kill -9` with a correct pgrep regex

### 1.0.5 — Detached bot process
- Uses `nohup` so the bot survives Claude Code exiting

### 1.0.4 and earlier
- Installer copies `SKILL.md` to the skill root for Claude Code discovery
- Japanese README
- `npx gogo-telegram-bot` one-command installer
- Renamed to `gogo-telegram-bot` under GoGo IT Lab
- Restructured as a Claude Code plugin for npm distribution
- `/telegram restart` and `/telegram stop` subcommands
- HTML entity escaping in tool-use messages
- Always send final result, even when it matches an intermediate text
