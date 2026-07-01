"use server";

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { parseTOML, stringifyTOML } from "confbox";
import { withLocalAuth } from "@/app/api/_lib/auth";

const execAsync = promisify(exec);

const JCODE_CONFIG_DIR = path.join(os.homedir(), ".jcode");
const JCODE_CONFIG_PATH = path.join(JCODE_CONFIG_DIR, "config.toml");

const JCODE_PROVIDER_ENV_PATH = (() => {
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configDir, "jcode", "provider-9router.env");
})();

const checkJcodeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where jcode" : "which jcode";
    await execAsync(command, { windowsHide: true });
    return true;
  } catch {
    try {
      await fs.access(JCODE_CONFIG_DIR);
      return true;
    } catch {
      return false;
    }
  }
};

const readConfig = async () => {
  try {
    const content = await fs.readFile(JCODE_CONFIG_PATH, "utf-8");
    return parseTOML(content);
  } catch {
    return { providers: {} };
  }
};

const has9RouterConfig = (config) => {
  if (!config || !config.providers) return false;

  const providers = config.providers;

  if (providers["9router"]) return true;

  for (const [, provider] of Object.entries(providers)) {
    // eslint-disable-next-line react-doctor/js-set-map-lookups -- string substring check, not array
    if (provider.base_url && provider.base_url.includes("localhost:20128")) {
      return true;
    }
  }

  return false;
};

const writeConfig = async (config) => {
  const content = stringifyTOML(config);
  await fs.writeFile(JCODE_CONFIG_PATH, content, "utf-8");
};

const readProviderEnv = async () => {
  try {
    const content = await fs.readFile(JCODE_PROVIDER_ENV_PATH, "utf-8");
    const env = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // eslint-disable-next-line react-doctor/js-set-map-lookups -- string search, not array
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    }

    return env;
  } catch {
    return {};
  }
};

const writeProviderEnv = async (env) => {
  let content = "# jcode provider environment variables\n";

  for (const [key, value] of Object.entries(env)) {
    content += `${key}="${value}"\n`;
  }

  await fs.writeFile(JCODE_PROVIDER_ENV_PATH, content, "utf-8");
};

export const GET = withLocalAuth(async () => {
  const isInstalled = await checkJcodeInstalled();

  if (!isInstalled) {
    // Install suggestion uses official jcode GitHub repo — validated source
    const installUrl = "https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh";
    const parsed = new URL(installUrl);
    if (parsed.hostname !== "raw.githubusercontent.com" || !parsed.pathname.startsWith("/1jehuang/jcode/")) {
      return NextResponse.json({ installed: false, message: "jcode not installed." });
    }
    return NextResponse.json({
      installed: false,
      // eslint-disable-next-line react-doctor/plugin-update-trust-risk -- installUrl is a hardcoded constant validated above
      message: `jcode not installed. Install via: curl -fsSL ${installUrl} | bash`,
    });
  }

  const config = await readConfig();
  const has9Router = has9RouterConfig(config);

  return NextResponse.json({
    installed: true,
    config,
    has9Router,
    configPath: JCODE_CONFIG_PATH,
  });
});

export const POST = withLocalAuth(async (request) => {
  try {
    const { baseUrl, apiKey, models } = await request.json();

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: "baseUrl and apiKey are required" },
        { status: 400 }
      );
    }

    const normalizedBaseUrl = baseUrl.endsWith("/v1")
      ? baseUrl
      : `${baseUrl}/v1`;

    const config = await readConfig();

    if (!config.providers) {
      config.providers = {};
    }

    config.providers["9router"] = {
      type: "openai-compatible",
      base_url: normalizedBaseUrl,
      auth: "bearer",
      api_key_env: "JCODE_9ROUTER_API_KEY",
      env_file: "provider-9router.env",
      default_model: models && models.length > 0 ? models[0] : "cc/claude-opus-4-7",
      requires_api_key: true,
    };

    await fs.mkdir(JCODE_CONFIG_DIR, { recursive: true });

    await writeConfig(config);

    const xdgConfigDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    const jcodeConfigDir = path.join(xdgConfigDir, "jcode");
    await fs.mkdir(jcodeConfigDir, { recursive: true });

    const env = await readProviderEnv();
    env.JCODE_9ROUTER_API_KEY = apiKey;
    await writeProviderEnv(env);

    return NextResponse.json({
      success: true,
      message: "jcode configured successfully. Use: jcode --provider-profile 9router",
      configPath: JCODE_CONFIG_PATH,
    });
  } catch (error) {
    console.error("Error configuring jcode:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

export const DELETE = withLocalAuth(async () => {
  try {
    const config = await readConfig();

    if (!config.providers) {
      return NextResponse.json({ success: true, message: "No configuration to remove" });
    }

    delete config.providers["9router"];

    await writeConfig(config);

    const env = await readProviderEnv();
    delete env.JCODE_9ROUTER_API_KEY;
    await writeProviderEnv(env);

    return NextResponse.json({
      success: true,
      message: "9router configuration removed from jcode",
    });
  } catch (error) {
    console.error("Error removing jcode configuration:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
