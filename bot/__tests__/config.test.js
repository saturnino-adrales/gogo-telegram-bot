import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig } from "../config.js";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("fs");

describe("loadConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads global config from ~/.claude/telegram-bot.yml", () => {
    const globalPath = path.join(os.homedir(), ".claude", "telegram-bot.yml");
    const globalYaml = `
telegram:
  bot_token: "GLOBAL_TOKEN"
  owner_id: 111111
defaults:
  permission_level: readonly
  acl: []
`;
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p === globalPath);
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      if (p === globalPath) return globalYaml;
      throw new Error("not found");
    });

    const config = loadConfig({ cwd: "/tmp/noproject" });

    expect(config.telegram.bot_token).toBe("GLOBAL_TOKEN");
    expect(config.telegram.owner_id).toBe(111111);
    expect(config.defaults.permission_level).toBe("readonly");
    expect(config.defaults.acl).toEqual([]);
  });

  it("project config overrides global config", () => {
    const globalPath = path.join(os.homedir(), ".claude", "telegram-bot.yml");
    const projectPath = "/myproject/telegram-bot.yml";
    const globalYaml = `
telegram:
  bot_token: "GLOBAL_TOKEN"
  owner_id: 111111
defaults:
  permission_level: readonly
  acl: []
`;
    const projectYaml = `
permission_level: full
acl:
  - 222222
`;
    vi.spyOn(fs, "existsSync").mockImplementation(
      (p) => p === globalPath || p === projectPath
    );
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      if (p === globalPath) return globalYaml;
      if (p === projectPath) return projectYaml;
      throw new Error("not found");
    });

    const config = loadConfig({ cwd: "/myproject" });

    expect(config.telegram.bot_token).toBe("GLOBAL_TOKEN");
    expect(config.defaults.permission_level).toBe("full");
    expect(config.defaults.acl).toEqual([222222]);
  });

  it("args override everything", () => {
    const globalPath = path.join(os.homedir(), ".claude", "telegram-bot.yml");
    const globalYaml = `
telegram:
  bot_token: "GLOBAL_TOKEN"
  owner_id: 111111
defaults:
  permission_level: readonly
  acl: []
`;
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p === globalPath);
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      if (p === globalPath) return globalYaml;
      throw new Error("not found");
    });

    const config = loadConfig({
      cwd: "/tmp/noproject",
      args: { permissionLevel: "standard", acl: [333333, 444444] },
    });

    expect(config.defaults.permission_level).toBe("standard");
    expect(config.defaults.acl).toEqual([333333, 444444]);
  });

  it("throws if no global config exists", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(() => loadConfig({ cwd: "/tmp" })).toThrow("Global config not found");
  });

  it("throws if bot_token is missing", () => {
    const globalPath = path.join(os.homedir(), ".claude", "telegram-bot.yml");
    const globalYaml = `
telegram:
  owner_id: 111111
defaults:
  permission_level: readonly
`;
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p === globalPath);
    vi.spyOn(fs, "readFileSync").mockImplementation((p) => {
      if (p === globalPath) return globalYaml;
      throw new Error("not found");
    });

    expect(() => loadConfig({ cwd: "/tmp" })).toThrow("bot_token");
  });
});
