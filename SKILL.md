---
name: telegram
description: Spawn an ephemeral Telegram bot backed by a Claude Code SDK session with full conversation context
---

# Telegram Bot Skill

Spawns a Telegram bot that bridges messages to a Claude Agent SDK session. The bot inherits the full conversation context from this session and can perform actions based on the configured permission level.

## Activation

Parse the user's arguments from the slash command input:

- `ps` → **list all running bot processes** (skip all other steps, just run the ps command below)
- `kill <PID>` → **kill a specific bot process** by PID
- `stop` → **kill all running bot processes**
- `restart` → **kill all running bots, then relaunch** with the same permission level as the killed process (parse it from the ps output). If can't determine, use config default.
- `--readonly` or `--ro` → permission level `readonly`
- `--standard` or `--std` → permission level `standard`
- `--full` → permission level `full`
- `--acl 123,456` → additional Telegram user IDs for this session
- No args → use config defaults

## Subcommands

### `/telegram ps` — List Running Bots

Run this command and display the results in a table:

```bash
ps aux | grep "[n]ode.*index.js.*--bot-token" | awk '{print $2, $NF}' 
```

For a richer view, parse the full command args from each process:

```bash
ps aux | grep "[n]ode.*index.js.*--bot-token"
```

Display as a table with columns: **PID**, **Permission Level**, **Working Directory**, **Uptime**. If no processes found, say "No Telegram bots running."

### `/telegram kill <PID>` — Kill a Bot

```bash
kill <PID>
```

Confirm the kill succeeded. If the user just says `/telegram kill` without a PID, run `/telegram ps` first and ask which one to kill.

### `/telegram stop` — Stop All Bots

```bash
pkill -9 -f "bot/index.js.*--bot-token"
```

Verify with `ps aux | grep "[b]ot/index.js.*--bot-token"` — should return nothing.

### `/telegram restart` — Restart Bot

1. Read the running bot's permission level from `ps` output (parse `--permission-level` from the command args)
2. Kill all running bots: `pkill -9 -f "bot/index.js.*--bot-token"`
3. Relaunch with the same permission level following the normal launch steps below

If no bot is running, just launch a new one.

## Steps (for launching a new bot)

### 1. Check Configs & Ask Which Bot to Use

Check for both config files:

```bash
# Global config
cat ~/.claude/telegram-bot.yml

# Project config
cat ./telegram-bot.yml
```

**Decision flow:**

- **Neither exists**: Tell the user they need to set up a bot first. Walk them through BotFather and ask if they want to save it as global or project-level.
- **Global only, no project config**: Ask the user:
  > Found global bot: `@BOT_USERNAME_HERE`
  > 
  > **A)** Use this bot for the current session
  > **B)** Register a new bot specifically for this project folder
  >
  > Which one?
  
  - If **A**: Use the global config.
  - If **B**: Walk them through creating a new bot with @BotFather, then save the token + owner_id to `./telegram-bot.yml` in the current project.

- **Project config exists**: Use it directly (project config takes priority). Inform the user:
  > Using project bot: `@PROJECT_BOT_USERNAME`

- **Both exist**: Use project config. Mention the global bot is available if they want to switch.

**When creating a new project bot**, write `./telegram-bot.yml`:

```yaml
telegram:
  bot_token: "TOKEN_FROM_BOTFATHER"
  owner_id: OWNER_ID_FROM_GLOBAL_OR_USER
defaults:
  permission_level: readonly
  acl: []
```

The `owner_id` can be inherited from the global config if it exists, so the user doesn't have to provide it again.

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
nohup node ~/.claude/skills/telegram-bot/bot/index.js \
  --bot-token "$BOT_TOKEN" \
  --owner-id "$OWNER_ID" \
  --permission-level "$PERMISSION_LEVEL" \
  --acl "$ACL_IDS" \
  --cwd "$(pwd)" \
  --context-file "$CONTEXT_FILE" \
  > /tmp/telegram-bot.log 2>&1 &
echo "PID: $!"
```

Run this with the Bash tool (NOT `run_in_background`). The `nohup` + `&` detaches the process so it survives after Claude Code exits. Logs go to `/tmp/telegram-bot.log`.

### 6. Report Success

Tell the user:

> Telegram bot is running (PID: [pid]).
> - Bot: @BOT_USERNAME
> - Permission level: [level]
> - Working directory: [cwd]
> - ACL: [user IDs]
>
> The bot has your full conversation context. Send messages via Telegram.
> Use /stop in Telegram to shut down the bot.

### 7. Monitor (Optional)

The bot process runs in the background. If the user asks to stop it, kill the PID.
