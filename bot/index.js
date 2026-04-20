import { Telegraf } from "telegraf";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import path from "path";
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

// --- PID / state file (cheap alternative to `ps aux` for skill discovery) ---
const STATE_FILE = "/tmp/gogo-telegram-bot.state.json";

function writeStateFile() {
  const state = {
    pid: process.pid,
    permissionLevel: currentPermLevel,
    cwd: config.cwd,
    ownerId: config.ownerId,
    acl: acl.list(),
    startedAt: new Date(startTime).toISOString(),
  };
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`State file written: ${STATE_FILE}`);
  } catch (e) {
    console.error(`Failed to write state file: ${e.message}`);
  }
}

function removeStateFile() {
  if (existsSync(STATE_FILE)) {
    try {
      unlinkSync(STATE_FILE);
    } catch {}
  }
}

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

// --- Detect context-limit errors from the SDK ---
function isContextLimitError(err) {
  const msg = (err?.message || String(err || "")).toLowerCase();
  return (
    msg.includes("prompt is too long") ||
    msg.includes("context_length_exceeded") ||
    msg.includes("maximum context length") ||
    msg.includes("context length exceeded") ||
    msg.includes("too many tokens")
  );
}

// --- Single-attempt query loop (inner) ---
async function runQuery(userMessage, onEvent) {
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

    // Emit intermediate events
    if (message.type === "assistant" && message.message?.content && onEvent) {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          onEvent({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          onEvent({ type: "tool", tool: block.name, input: block.input });
        }
      }
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

// --- Send a message to the SDK; auto-rotate session on context-limit errors ---
async function askSdk(userMessage, onEvent) {
  try {
    return await runQuery(userMessage, onEvent);
  } catch (err) {
    if (isContextLimitError(err) && sessionId !== null) {
      console.error(`[CTX] Context limit hit, rotating session and retrying once`);
      sessionId = null;
      if (onEvent) {
        onEvent({
          type: "text",
          text: "_(context was full — started a fresh session and retried)_",
        });
      }
      return await runQuery(userMessage, onEvent);
    }
    throw err;
  }
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

// /reset — any ACL'd user, starts a fresh SDK session
bot.command("reset", async (ctx) => {
  if (!acl.isAllowed(ctx.from.id)) return;
  const prev = sessionId;
  sessionId = null;
  console.log(`[RESET] Session cleared (was ${prev || "none"})`);
  await ctx.reply(
    prev
      ? `Session cleared. Next message starts fresh.\n<i>Previous session:</i> <code>${prev}</code>`
      : "No active session. Next message will start one.",
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
  writeStateFile();
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
    writeStateFile();
    await ctx.reply(`Added user ${userId} to ACL.`);
  } else if (action === "remove" && userId) {
    acl.remove(Number(userId));
    writeStateFile();
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

// --- Extract and download attachments from a Telegram message ---
// Returns an array of absolute local file paths.
async function downloadAttachments(ctx) {
  const msg = ctx.message;
  const specs = [];

  if (msg.photo) {
    const largest = msg.photo[msg.photo.length - 1];
    specs.push({ fileId: largest.file_id, name: `photo_${largest.file_unique_id}.jpg` });
  }
  if (msg.document) {
    specs.push({
      fileId: msg.document.file_id,
      name: msg.document.file_name || `doc_${msg.document.file_unique_id}`,
    });
  }
  if (msg.video) {
    specs.push({
      fileId: msg.video.file_id,
      name: msg.video.file_name || `video_${msg.video.file_unique_id}.mp4`,
    });
  }
  if (msg.audio) {
    specs.push({
      fileId: msg.audio.file_id,
      name: msg.audio.file_name || `audio_${msg.audio.file_unique_id}.mp3`,
    });
  }
  if (msg.voice) {
    specs.push({ fileId: msg.voice.file_id, name: `voice_${msg.voice.file_unique_id}.ogg` });
  }
  if (msg.video_note) {
    specs.push({ fileId: msg.video_note.file_id, name: `videonote_${msg.video_note.file_unique_id}.mp4` });
  }
  if (msg.animation) {
    specs.push({
      fileId: msg.animation.file_id,
      name: msg.animation.file_name || `anim_${msg.animation.file_unique_id}.mp4`,
    });
  }
  if (msg.sticker) {
    specs.push({ fileId: msg.sticker.file_id, name: `sticker_${msg.sticker.file_unique_id}.webp` });
  }

  if (specs.length === 0) return [];

  const uploadsDir = path.join(config.cwd, ".telegram-uploads");
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const paths = [];
  for (const spec of specs) {
    try {
      const link = await ctx.telegram.getFileLink(spec.fileId);
      const res = await fetch(link.href);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const safeName = spec.name.replace(/[^\w\-.]/g, "_");
      const savePath = path.join(uploadsDir, `${Date.now()}_${safeName}`);
      writeFileSync(savePath, buf);
      paths.push(savePath);
      console.log(`[DL] ${savePath} (${buf.length} bytes)`);
    } catch (e) {
      console.error(`[DL_ERR] ${spec.name}: ${e.message}`);
    }
  }
  return paths;
}

// --- Escape HTML entities for Telegram ---
function escHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Format tool name for display ---
function formatToolArg(tool, input) {
  if (!input) return escHtml(tool);
  if (input.file_path) return `${escHtml(tool)} (${escHtml(input.file_path.split("/").pop())})`;
  if (input.pattern) return `${escHtml(tool)} ("${escHtml(input.pattern)}")`;
  if (input.command) return `${escHtml(tool)} (${escHtml(input.command.slice(0, 40))}${input.command.length > 40 ? "..." : ""})`;
  if (input.skill) return `${escHtml(tool)} (${escHtml(input.skill)})`;
  return escHtml(tool);
}

// Regular messages — forward to SDK
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  const textPart = msg.text || msg.caption || "";
  const hasAttachment = !!(
    msg.photo || msg.document || msg.video || msg.audio ||
    msg.voice || msg.video_note || msg.animation || msg.sticker
  );

  if (!textPart && !hasAttachment) return;

  console.log(`[MSG] From ${ctx.from.id}: text="${textPart.slice(0, 80)}" attachment=${hasAttachment}`);
  if (!acl.isAllowed(ctx.from.id)) {
    console.log(`[ACL] Rejected user ${ctx.from.id}`);
    return;
  }

  // Keep typing indicator alive every 4s until response is ready
  const typingInterval = setInterval(() => {
    ctx.sendChatAction("typing").catch(() => {});
  }, 4000);
  await ctx.sendChatAction("typing");

  try {
    // Download any attachments first
    let attachmentPaths = [];
    if (hasAttachment) {
      attachmentPaths = await downloadAttachments(ctx);
      console.log(`[ATT] Downloaded ${attachmentPaths.length} file(s)`);
    }

    // Build the user message for the SDK
    let userMessage = textPart;
    if (attachmentPaths.length > 0) {
      const list = attachmentPaths.map((p) => `- ${p}`).join("\n");
      const header = attachmentPaths.length === 1
        ? "The user attached 1 file via Telegram:"
        : `The user attached ${attachmentPaths.length} files via Telegram:`;
      userMessage = (textPart ? `${textPart}\n\n` : "") +
        `${header}\n${list}\n\nUse the Read tool to inspect the file(s) as needed.`;
    }

    // Collect tools used and intermediate text
    const toolsUsed = [];
    let toolMsgId = null;
    const intermediateTexts = [];

    console.log("[SDK] Sending to Claude...");
    const response = await askSdk(userMessage, async (event) => {
      if (event.type === "tool") {
        console.log(`[TOOL] ${event.tool}`);
        toolsUsed.push(formatToolArg(event.tool, event.input));
        const toolList = toolsUsed.map((t) => `  ${t}`).join("\n");
        const toolText = `<b>Tools used:</b>\n<pre>${toolList}</pre>`;
        try {
          if (toolMsgId) {
            // Edit existing tool message
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              toolMsgId,
              null,
              toolText,
              { parse_mode: "HTML" }
            );
          } else {
            // Send first tool message
            const sent = await ctx.reply(toolText, { parse_mode: "HTML" });
            toolMsgId = sent.message_id;
          }
        } catch (e) {
          console.error(`[TOOL_SEND_ERR] ${e.message}`);
        }
      } else if (event.type === "text") {
        console.log(`[TEXT] Intermediate: ${event.text.slice(0, 80)}`);
        intermediateTexts.push(event.text);
      }
    });

    console.log(`[SDK] Done. Result length: ${response?.length || 0}, intermediates: ${intermediateTexts.length}`);

    // Send intermediate texts that are NOT the final result (e.g. "Let me check...")
    for (const text of intermediateTexts) {
      if (text !== response && text.length > 0) {
        const html = mdToTelegramHtml(text);
        try {
          await ctx.reply(html, { parse_mode: "HTML" });
          console.log(`[SENT] Intermediate text (${text.length} chars)`);
        } catch (e) {
          console.error(`[HTML_ERR] ${e.message}, falling back to plain text`);
          await ctx.reply(text);
        }
      }
    }

    // Always send the final result
    if (response) {
      const html = mdToTelegramHtml(response);
      const chunks = chunkMessage(html);
      for (const chunk of chunks) {
        try {
          await ctx.reply(chunk, { parse_mode: "HTML" });
          console.log(`[SENT] Final result chunk (${chunk.length} chars)`);
        } catch (e) {
          console.error(`[HTML_ERR] ${e.message}, falling back to plain text`);
          await ctx.reply(chunk);
        }
      }
    } else if (intermediateTexts.length === 0) {
      await ctx.reply("(No response from Claude)");
    }

    // Stop typing only after all messages are sent
    clearInterval(typingInterval);
  } catch (err) {
    clearInterval(typingInterval);
    console.error(`[ERR] ${err.message}`);
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
  removeStateFile();
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
// Log unhandled rejections but keep the bot alive. Transient SDK / network
// failures on a single message must not take down the whole process.
process.on("unhandledRejection", (err) => {
  console.error("[UNHANDLED_REJECTION]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT_EXCEPTION]", err);
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
    writeStateFile();
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
