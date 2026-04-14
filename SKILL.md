---
name: telegram
description: Spawn an ephemeral Telegram bot backed by a Claude Code SDK session with full conversation context
---

# Telegram Bot Skill

Spawns a Telegram bot that bridges messages to a Claude Agent SDK session. The bot inherits the full conversation context from this session and can perform actions based on the configured permission level.

## Activation

Parse the user's arguments from the slash command input:

- `--readonly` or `--ro` → permission level `readonly`
- `--standard` or `--std` → permission level `standard`
- `--full` → permission level `full`
- `--acl 123,456` → additional Telegram user IDs for this session
- No args → use config defaults

## Steps

### 1. Load Config

Read the layered config:

```bash
# Global config (required)
cat ~/.claude/telegram-bot.yml

# Project config (optional)
cat ./telegram-bot.yml
```

If `~/.claude/telegram-bot.yml` does not exist, tell the user:

> Create `~/.claude/telegram-bot.yml` with:
> ```yaml
> telegram:
>   bot_token: "YOUR_BOT_TOKEN"
>   owner_id: YOUR_TELEGRAM_USER_ID
> defaults:
>   permission_level: readonly
>   acl: []
> ```
> Get a bot token from @BotFather on Telegram.

### 2. Auto-Install Dependencies

Check if `node_modules` exists in the bot directory. If not, install:

```bash
cd ~/.claude/skills/telegram-bot/bot && npm install
```

### 3. Extract Conversation Context

Extract the full conversation transcript from this session. Write it to a temporary file:

```bash
CONTEXT_FILE=$(mktemp /tmp/telegram-context-XXXXX.json)
```

Write the conversation history (all messages exchanged so far in this session) to this temp file as plain text.

### 4. Parse Permission Level

Determine the permission level from args:

```
--readonly or --ro  → "readonly"
--standard or --std → "standard"
--full              → "full"
no flag             → read from config defaults
```

### 5. Spawn the Bot

Build the command with resolved config values:

```bash
node ~/.claude/skills/telegram-bot/bot/index.js \
  --bot-token "$BOT_TOKEN" \
  --owner-id "$OWNER_ID" \
  --permission-level "$PERMISSION_LEVEL" \
  --acl "$ACL_IDS" \
  --cwd "$(pwd)" \
  --context-file "$CONTEXT_FILE"
```

Run this as a **background process** using the Bash tool with `run_in_background: true`.

### 6. Report Success

Tell the user:

> Telegram bot is running (PID: [pid]).
> - Permission level: [level]
> - Working directory: [cwd]
> - ACL: [user IDs]
>
> The bot has your full conversation context. Send messages via Telegram.
> Use /stop in Telegram to shut down the bot.

### 7. Monitor (Optional)

The bot process runs in the background. If the user asks to stop it, kill the PID.
