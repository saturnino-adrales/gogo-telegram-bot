#!/usr/bin/env node

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, cpSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const skillDir = join(homedir(), ".claude", "skills", "telegram-bot");
const srcDir = join(new URL(".", import.meta.url).pathname);

console.log("Installing gogo-telegram-bot skill...\n");

if (!existsSync(skillDir)) {
  mkdirSync(skillDir, { recursive: true });
}

const dirs = [".claude-plugin", "skills", "bot"];
for (const dir of dirs) {
  const src = join(srcDir, dir);
  const dest = join(skillDir, dir);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`  Copied ${dir}/`);
  }
}

console.log("\n  Installing bot dependencies...");
execFileSync("npm", ["install", "--production"], {
  cwd: join(skillDir, "bot"),
  stdio: "inherit",
});

console.log(`
Done! Skill installed to ${skillDir}

Next steps:
  1. Get a bot token from @BotFather on Telegram
  2. Get your user ID from @userinfobot
  3. Create ~/.claude/telegram-bot.yml:

     telegram:
       bot_token: "YOUR_TOKEN"
       owner_id: YOUR_USER_ID
     defaults:
       permission_level: readonly
       acl: []

  4. Use /telegram-bot in Claude Code!
`);
