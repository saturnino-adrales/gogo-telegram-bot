import { Telegraf } from "telegraf";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { createAcl } from "./acl.js";
import { getToolsForLevel, PERMISSION_LEVELS } from "./permissions.js";
import { chunkMessage } from "./chunker.js";
import { mdToTelegramHtml } from "./formatter.js";

// --- Parse CLI args ---
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
      .replace(/^--/, "")
      .replace(/-./g, (m) => m[1].toUpperCase());
    parsed[key] = args[i + 1];
  }
  return {
    botToken: parsed.botToken,
    ownerId: Number(parsed.ownerId),
    permissionLevel: parsed.permissionLevel || "readonly",
    acl: parsed.acl ? parsed.acl.split(",").map(Number) : [],
    cwd: parsed.cwd || process.cwd(),
    contextFile: parsed.contextFile,
  };
}

const config = parseArgs();

// --- Load conversation context ---
let conversationContext = "";
if (config.contextFile && existsSync(config.contextFile)) {
  conversationContext = readFileSync(config.contextFile, "utf8");
}

// --- ACL & Permissions (mutable for live changes) ---
const acl = createAcl({ ownerId: config.ownerId, allowedIds: config.acl });
let currentPermLevel = config.permissionLevel;
let allowedTools = getToolsForLevel(currentPermLevel);

// --- SDK session state ---
let sessionId = null;
const startTime = Date.now();

// --- Build the system prompt with conversation context ---
function buildSystemPrompt() {
  let prompt =
    "You are continuing a conversation from Claude Code. The user is now communicating with you via Telegram.\n\n";
  if (conversationContext) {
    prompt += "Here is the full prior conversation context:\n\n";
    prompt += conversationContext;
    prompt += "\n\n---\nNew messages below are from Telegram.\n";
  }
  return prompt;
}

// --- Send a message to the SDK session and return the response ---
async function askSdk(userMessage) {
  const isFirstMessage = sessionId === null;

  const prompt = isFirstMessage
    ? `${buildSystemPrompt()}\n\nUser message: ${userMessage}`
    : userMessage;

  const options = {
    allowedTools,
    cwd: config.cwd,
  };

  if (sessionId) {
    options.resume = sessionId;
  }

  let result = "";

  for await (const message of query({ prompt, options })) {
    if (
      message.type === "system" &&
      message.subtype === "init" &&
      message.session_id
    ) {
      sessionId = message.session_id;
    }
    if (message.type === "result") {
      result = message.result || "";
      if (message.session_id) {
        sessionId = message.session_id;
      }
    }
  }

  return result;
}

// --- Telegram Bot ---
const bot = new Telegraf(config.botToken);

// /stop — owner only, shuts down
bot.command("stop", async (ctx) => {
  if (!acl.isOwner(ctx.from.id)) return;
  await ctx.reply("Bot offline.");
  cleanup();
  process.exit(0);
});

// /status — any ACL'd user
bot.command("status", async (ctx) => {
  if (!acl.isAllowed(ctx.from.id)) return;
  const uptime = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(uptime / 60);
  const secs = uptime % 60;
  await ctx.reply(
    `<b>Status</b>\nPermissions: <code>${currentPermLevel}</code>\nWorking dir: <code>${config.cwd}</code>\nUptime: ${mins}m ${secs}s\nSession: <code>${sessionId || "not started"}</code>`,
    { parse_mode: "HTML" }
  );
});

// /perms — any ACL'd user
bot.command("perms", async (ctx) => {
  if (!acl.isAllowed(ctx.from.id)) return;
  await ctx.reply(
    `<b>Permission level:</b> <code>${currentPermLevel}</code>\n<b>Allowed tools:</b>\n${allowedTools.map((t) => `• ${t}`).join("\n")}`,
    { parse_mode: "HTML" }
  );
});

// /permlevel — owner only, change permissions live
bot.command("permlevel", async (ctx) => {
  if (!acl.isOwner(ctx.from.id)) return;

  const newLevel = ctx.message.text.replace(/^\/permlevel\s*/, "").trim();

  if (!newLevel) {
    await ctx.reply(
      `<b>Current:</b> <code>${currentPermLevel}</code>\n<b>Usage:</b> <code>/permlevel readonly|standard|full</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (!PERMISSION_LEVELS.includes(newLevel)) {
    await ctx.reply(
      `Unknown level: <code>${newLevel}</code>\nMust be: <code>${PERMISSION_LEVELS.join(" | ")}</code>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  currentPermLevel = newLevel;
  allowedTools = getToolsForLevel(newLevel);
  await ctx.reply(
    `Permissions changed to <b>${newLevel}</b>\n${allowedTools.map((t) => `• ${t}`).join("\n")}`,
    { parse_mode: "HTML" }
  );
});

// /acl — owner only
bot.command("acl", async (ctx) => {
  if (!acl.isOwner(ctx.from.id)) return;

  const text = ctx.message.text.replace(/^\/acl\s*/, "").trim();
  const [action, userId] = text.split(/\s+/);

  if (action === "add" && userId) {
    acl.add(Number(userId));
    await ctx.reply(`Added user ${userId} to ACL.`);
  } else if (action === "remove" && userId) {
    acl.remove(Number(userId));
    await ctx.reply(`Removed user ${userId} from ACL.`);
  } else {
    const users = acl.list().join(", ");
    await ctx.reply(`*ACL users:* ${users}`, { parse_mode: "Markdown" });
  }
});

// /context — any ACL'd user
bot.command("context", async (ctx) => {
  if (!acl.isAllowed(ctx.from.id)) return;
  const contextLen = conversationContext.length;
  const summary =
    contextLen > 0
      ? `Conversation context loaded: ${contextLen} characters from Claude Code session.`
      : "No conversation context loaded.";
  await ctx.reply(summary);
});

// Regular messages — forward to SDK
bot.on("message", async (ctx) => {
  if (!ctx.message.text) return;
  if (!acl.isAllowed(ctx.from.id)) return;

  // Keep typing indicator alive every 4s until response is ready
  const typingInterval = setInterval(() => {
    ctx.sendChatAction("typing").catch(() => {});
  }, 4000);
  await ctx.sendChatAction("typing");

  try {
    const response = await askSdk(ctx.message.text);
    clearInterval(typingInterval);

    if (!response) {
      await ctx.reply("(No response from Claude)");
      return;
    }

    const html = mdToTelegramHtml(response);
    const chunks = chunkMessage(html);
    for (const chunk of chunks) {
      try {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      } catch {
        // HTML parse failed — send as plain text
        await ctx.reply(chunk);
      }
    }
  } catch (err) {
    clearInterval(typingInterval);
    await ctx.reply(`Error: ${err.message}`);
  }
});

// --- Cleanup ---
function cleanup() {
  if (config.contextFile && existsSync(config.contextFile)) {
    try {
      unlinkSync(config.contextFile);
    } catch {}
  }
  bot.stop();
}

process.once("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// --- Launch ---
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});

console.log("Telegram bot starting...");
console.log(`Permission level: ${config.permissionLevel}`);
console.log(`Working directory: ${config.cwd}`);
console.log(`ACL: ${acl.list().join(", ")}`);

async function main() {
  try {
    // Delete webhook first to ensure clean polling start
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    // Don't await launch() — it never resolves in Telegraf v4 polling mode.
    // Just call it to start the polling loop.
    bot.launch({ dropPendingUpdates: true });
    console.log("Telegram bot is running.");

    try {
      await bot.telegram.sendMessage(
        config.ownerId,
        `*Bot online*\nPermissions: \`${config.permissionLevel}\`\nDirectory: \`${config.cwd}\`\nSend /stop to shut down.`,
        { parse_mode: "Markdown" }
      );
      console.log("Startup message sent to owner.");
    } catch (err) {
      console.error("Could not send startup message to owner:", err.message);
    }
  } catch (err) {
    console.error("Bot launch failed:", err.message);
    process.exit(1);
  }
}

main();
