"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { withLocalAuth } from "@/app/api/_lib/auth";

const execAsync = promisify(exec);

const OPENCODE_CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
const OPENCODE_CONFIG_PATH = path.join(OPENCODE_CONFIG_DIR, "opencode.json");

// Check if opencode CLI is installed (via which/where or config file exists)
const checkOpenCodeInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where opencode" : "which opencode";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(OPENCODE_CONFIG_PATH);
      return true;
    } catch {
      return false;
    }
  }
};

const readConfig = async () => {
  try {
    const content = await fs.readFile(OPENCODE_CONFIG_PATH, "utf-8");
    const stripped = content.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
};

const has9RouterConfig = (config) => {
  if (!config?.provider) return false;
  return !!config.provider["9router"];
};

// GET - Check opencode CLI and read current settings
export const GET = withLocalAuth(async () => {
  try {
    const isInstalled = await checkOpenCodeInstalled();

    if (!isInstalled) {
      return NextResponse.json({
        installed: false,
        config: null,
        message: "OpenCode CLI is not installed",
      });
    }

    const config = await readConfig();
    const providerConfig = config?.provider?.["9router"];
    const modelMap = providerConfig?.models || {};

    return NextResponse.json({
      installed: true,
      config,
      has9Router: has9RouterConfig(config),
      configPath: OPENCODE_CONFIG_PATH,
        opencode: {
          models: Object.keys(modelMap),
          activeModel: config?.model?.startsWith("9router/") ? config.model.replace(/^9router\//, "") : null,
          baseURL: providerConfig?.options?.baseURL || null,
        },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check opencode settings" }, { status: 500 });
  }
});

// POST - Apply 9Router as openai-compatible provider (multi-model support)
export const POST = withLocalAuth(async (request) => {
  try {
    const { baseUrl, apiKey, model, models, activeModel, subagentModel } = await request.json();

    // Accept either `model` (string, legacy) or `models` (array of strings)
    const modelsArray = Array.isArray(models) ? models.slice() : (typeof model === "string" ? [model] : []);

    if (!baseUrl || modelsArray.length === 0) {
      return NextResponse.json({ error: "baseUrl and at least one model are required" }, { status: 400 });
    }

    await fs.mkdir(OPENCODE_CONFIG_DIR, { recursive: true });

    // Read existing config or start fresh
    let config = {};
    try {
      const existing = await fs.readFile(OPENCODE_CONFIG_PATH, "utf-8");
      config = JSON.parse(existing);
    } catch { /* No existing config */ }

    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    const keyToUse = apiKey || "sk_9router";
    const effectiveSubagentModel = subagentModel || modelsArray[0];

    // Ensure provider object
    if (!config.provider) config.provider = {};

    // Preserve any existing 9router provider entry and its models
    const existingProvider = config.provider["9router"] || { npm: "@ai-sdk/openai-compatible", options: {}, models: {} };

    // Merge options (overwrite baseURL/apiKey)
    existingProvider.options = {
      ...existingProvider.options,
      baseURL: normalizedBaseUrl,
      apiKey: keyToUse,
    };

    // Ensure models map exists
    existingProvider.models = existingProvider.models || {};

    // Add or update entries for all requested models
    for (const m of modelsArray) {
      if (!m || typeof m !== "string") continue;
      existingProvider.models[m] = { name: m, modalities: { input: ["text", "image"], output: ["text"] } };
    }

    // Save merged provider back
    config.provider["9router"] = existingProvider;

    // Set the active model: prefer explicit activeModel, else first of modelsArray
    if (activeModel === "") {
      config.model = "";
    } else {
      const finalActive = activeModel || modelsArray[0];
      if (finalActive) {
        config.model = `9router/${finalActive}`;
      }
    }

    // Add subagent configuration
    if (!config.agent) config.agent = {};
    config.agent.explorer = {
      description: "Fast explorer subagent for codebase exploration",
      mode: "subagent",
      model: `9router/${effectiveSubagentModel}`,
    };

    await fs.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: "OpenCode settings applied successfully!",
      configPath: OPENCODE_CONFIG_PATH,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to apply settings" }, { status: 500 });
  }
});

// PATCH - Update specific settings (e.g., clear active model)
export const PATCH = withLocalAuth(async (request) => {
  try {
    const { clearActiveModel } = await request.json();

    let config = {};
    try {
      const existing = await fs.readFile(OPENCODE_CONFIG_PATH, "utf-8");
      config = JSON.parse(existing);
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({ success: true, message: "No config file found" });
      }
      throw error;
    }

    if (clearActiveModel === true) {
      // Clear active model but keep models in the list
      if (config.model?.startsWith("9router/")) {
        config.model = "";
      }
    }

    await fs.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: "Settings updated",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to patch settings" }, { status: 500 });
  }
});

// DELETE - Remove 9Router provider or specific models from config
export const DELETE = withLocalAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const modelToRemove = searchParams.get("model");

    let config = {};
    try {
      const existing = await fs.readFile(OPENCODE_CONFIG_PATH, "utf-8");
      config = JSON.parse(existing);
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({ success: true, message: "No config file to reset" });
      }
      throw error;
    }

    // If specific model provided, remove just that model
    if (modelToRemove && config.provider?.["9router"]?.models) {
      delete config.provider["9router"].models[modelToRemove];

      // If no models left, remove the provider
      if (Object.keys(config.provider["9router"].models).length === 0) {
        delete config.provider["9router"];
        if (config.model?.startsWith("9router/")) delete config.model;
      } else if (config.model === `9router/${modelToRemove}`) {
        // If removed model was active, switch to first remaining model
        const remainingModels = Object.keys(config.provider["9router"].models);
        config.model = `9router/${remainingModels[0]}`;
      }
    } else {
      // No specific model - remove entire 9router provider
      if (config.provider) delete config.provider["9router"];
      if (config.model?.startsWith("9router/")) delete config.model;
    }

    // Remove subagent configuration
    if (config.agent?.explorer?.model?.startsWith("9router/")) {
      delete config.agent.explorer;
      // Clean up empty agent object
      if (Object.keys(config.agent).length === 0) delete config.agent;
    }

    await fs.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({
      success: true,
      message: modelToRemove ? `Model "${modelToRemove}" removed` : "9Router settings removed from OpenCode",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to reset opencode settings" }, { status: 500 });
  }
});
