import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";

/**
 * Load config with priority: args > project > global.
 * @param {{ cwd: string, args?: { permissionLevel?: string, acl?: number[] } }} options
 * @returns {object} merged config
 */
export function loadConfig({ cwd, args = {} }) {
  const globalPath = path.join(os.homedir(), ".claude", "telegram-bot.yml");

  if (!fs.existsSync(globalPath)) {
    throw new Error(
      `Global config not found at ${globalPath}. Create it with bot_token and owner_id.`
    );
  }

  const globalConfig = yaml.load(fs.readFileSync(globalPath, "utf8"));

  if (!globalConfig?.telegram?.bot_token) {
    throw new Error(
      `bot_token is required in ${globalPath} under telegram.bot_token`
    );
  }

  const config = {
    telegram: { ...globalConfig.telegram },
    defaults: {
      permission_level: globalConfig.defaults?.permission_level || "readonly",
      acl: globalConfig.defaults?.acl || [],
    },
  };

  const projectPath = path.join(cwd, "telegram-bot.yml");
  if (fs.existsSync(projectPath)) {
    const projectConfig = yaml.load(fs.readFileSync(projectPath, "utf8"));
    if (projectConfig?.permission_level) {
      config.defaults.permission_level = projectConfig.permission_level;
    }
    if (projectConfig?.acl) {
      config.defaults.acl = projectConfig.acl;
    }
  }

  if (args.permissionLevel) {
    config.defaults.permission_level = args.permissionLevel;
  }
  if (args.acl) {
    config.defaults.acl = args.acl;
  }

  return config;
}
