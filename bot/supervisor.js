#!/usr/bin/env node
// Supervisor: keeps the bot alive. If the child exits for any reason other
// than a clean /stop (exit code 0), respawn it with exponential backoff.
//
// The bot process is fragile on long operations (context exhaustion, polling
// loop wedging, unexpected OS kills). Users want reliable responses, not
// silent death. This wrapper makes "dying" a non-issue.

import { spawn } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_SCRIPT = path.join(__dirname, "index.js");
const STATE_FILE = "/tmp/gogo-telegram-bot.state.json";

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const HEALTHY_UPTIME_MS = 60000; // if child lives longer than this, reset backoff

let child = null;
let shuttingDown = false;
let backoff = MIN_BACKOFF_MS;
let lastSpawnAt = 0;
let respawnCount = 0;

function writeSupervisorState() {
  try {
    writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          supervisorPid: process.pid,
          childPid: child?.pid ?? null,
          respawnCount,
          lastSpawnAt: lastSpawnAt ? new Date(lastSpawnAt).toISOString() : null,
        },
        null,
        2
      )
    );
  } catch (e) {
    console.error(`[SUPERVISOR] Failed to write state: ${e.message}`);
  }
}

function removeStateFile() {
  if (existsSync(STATE_FILE)) {
    try {
      unlinkSync(STATE_FILE);
    } catch {}
  }
}

function spawnBot() {
  lastSpawnAt = Date.now();
  respawnCount++;
  console.log(
    `[SUPERVISOR] Spawning bot (attempt #${respawnCount}) at ${new Date().toISOString()}`
  );

  child = spawn(process.execPath, [BOT_SCRIPT, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: {
      ...process.env,
      GOGO_BOT_SUPERVISOR_PID: String(process.pid),
    },
  });

  child.on("exit", (code, signal) => {
    const lived = Date.now() - lastSpawnAt;
    console.log(
      `[SUPERVISOR] Bot exited code=${code} signal=${signal} after ${lived}ms`
    );

    if (shuttingDown) {
      console.log("[SUPERVISOR] Shutdown in progress; not restarting.");
      removeStateFile();
      process.exit(code ?? 0);
      return;
    }

    // Clean exit via /stop or SIGINT/SIGTERM → exit code 0 → honor it.
    if (code === 0) {
      console.log("[SUPERVISOR] Clean exit — not restarting.");
      removeStateFile();
      process.exit(0);
      return;
    }

    // Reset backoff if the child ran long enough to be considered healthy
    if (lived >= HEALTHY_UPTIME_MS) {
      backoff = MIN_BACKOFF_MS;
    }

    console.log(`[SUPERVISOR] Restarting in ${backoff}ms...`);
    setTimeout(() => {
      if (shuttingDown) return;
      spawnBot();
      writeSupervisorState();
    }, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  });

  child.on("error", (err) => {
    console.error(`[SUPERVISOR] Spawn error: ${err.message}`);
  });
}

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[SUPERVISOR] Received ${signal}, forwarding to child...`);

  if (child && !child.killed) {
    child.kill(signal);
    // If child doesn't die within 5s, SIGKILL it.
    setTimeout(() => {
      if (child && !child.killed) {
        console.log("[SUPERVISOR] Child didn't exit, SIGKILL");
        try {
          child.kill("SIGKILL");
        } catch {}
      }
    }, 5000).unref();
  } else {
    removeStateFile();
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Don't die on our own unhandled rejections either
process.on("unhandledRejection", (err) => {
  console.error("[SUPERVISOR] Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[SUPERVISOR] Uncaught exception:", err);
});

console.log(`[SUPERVISOR] Starting. Bot script: ${BOT_SCRIPT}`);
spawnBot();
writeSupervisorState();
