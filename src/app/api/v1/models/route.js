import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS, getModelKind } from "@/shared/constants/models";
import {
  AI_PROVIDERS,
  getProviderAlias,
  isAnthropicCompatibleProvider,
  isOpenAICompatibleProvider,
} from "@/shared/constants/providers";
import { getProviderConnections, getCombos, getCustomModels, getModelAliases } from "@/lib/localDb";
import { getDisabledModels } from "@/lib/disabledModelsDb";
import { resolveKiroModels } from "open-sse/services/kiroModels.js";
import { resolveKimchiModels } from "open-sse/services/kimchiModels.js";
import { resolveQoderModels } from "open-sse/services/qoderModels.js";
import { resolveCopilotModels } from "open-sse/services/copilotModels.js";
import { updateProviderCredentials } from "@/sse/services/tokenRefresh";
import { capabilitiesFromServiceKind } from "open-sse/providers/capabilities.js";

// Per-provider live model resolvers. Each receives a connection record and
// returns { models: [{ id, name? }, ...] } | null on failure.
// Adding a provider here makes /v1/models prefer the live catalog for it.
const LIVE_MODEL_RESOLVERS = {
  kiro: async (conn) => {
    const result = await resolveKiroModels({
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      providerSpecificData: conn.providerSpecificData || {}
    }, { log: console });
    return result?.models?.length ? { models: result.models } : null;
  },
  qoder: async (conn) => {
    const result = await resolveQoderModels({
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      email: conn.email,
      displayName: conn.displayName,
      providerSpecificData: conn.providerSpecificData || {}
    });
    if (!result?.models?.length) return null;
    return {
      models: result.models.map((m) => ({ id: m.id, name: m.name })),
    };
  },
  kimchi: async (conn) => {
    const result = await resolveKimchiModels({
      accessToken: conn.accessToken,
      apiKey: conn.apiKey,
      providerSpecificData: conn.providerSpecificData || {}
    }, { log: console });
    return result?.models?.length ? { models: result.models } : null;
  },
  github: async (conn) => {
    const result = await resolveCopilotModels({
      accessToken: conn.accessToken,
      refreshToken: conn.refreshToken,
      providerSpecificData: conn.providerSpecificData || {}
    }, {
      log: console,
      onCredentialsRefreshed: async (refreshed) => {
        await updateProviderCredentials(conn.id, {
          copilotToken: refreshed.copilotToken,
          copilotTokenExpiresAt: refreshed.copilotTokenExpiresAt,
          existingProviderSpecificData: conn.providerSpecificData || {},
        });
      },
    });
    return result?.models?.length ? { models: result.models } : null;
  }
};

const parseOpenAIStyleModels = (data) => {
  if (Array.isArray(data)) return data;
  return data?.data || data?.models || data?.results || [];
};

// Matches provider IDs that are upstream/cross-instance connections (contain a UUID suffix)
const UPSTREAM_CONNECTION_RE = /[-_][0-9a-f]{8,}$/i;

// LLM kind sentinel — combos/models with no explicit kind default to LLM
const LLM_KIND = "llm";

// Map per-model `type` field (in PROVIDER_MODELS) to service kind.
// Models without `type` are treated as LLM.
const MODEL_TYPE_TO_KIND = {
  image: "image",
  tts: "tts",
  embedding: "embedding",
  stt: "stt",
  imageToText: "imageToText",
};

function modelKind(model) {
  const k = model?.kind || model?.type;
  if (!k) return LLM_KIND;
  return MODEL_TYPE_TO_KIND[k] || LLM_KIND;
}

// For dynamic/unknown model IDs (compatible providers, alias map, custom models)
// fall back to provider-level kind matching when per-model type is unavailable.
function inferKindFromUnknownModelId(modelId) {
  const lower = String(modelId).toLowerCase();
  if (/embed/.test(lower)) return "embedding";
  if (/tts|speech|audio|voice/.test(lower)) return "tts";
  if (/image|imagen|dall-?e|flux|sdxl|sd-|stable-diffusion/.test(lower)) return "image";
  return LLM_KIND;
}

async function fetchCompatibleModelIds(connection) {
  if (!connection?.apiKey) return [];

  const baseUrl = typeof connection?.providerSpecificData?.baseUrl === "string"
    ? connection.providerSpecificData.baseUrl.trim().replace(/\/$/, "")
    : "";

  if (!baseUrl) return [];

  let url = `${baseUrl}/models`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (isOpenAICompatibleProvider(connection.provider)) {
    headers.Authorization = `Bearer ${connection.apiKey}`;
  } else if (isAnthropicCompatibleProvider(connection.provider)) {
    if (url.endsWith("/messages/models")) {
      url = url.slice(0, -9);
    } else if (url.endsWith("/messages")) {
      url = `${url.slice(0, -9)}/models`;
    }
    headers["x-api-key"] = connection.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers.Authorization = `Bearer ${connection.apiKey}`;
  } else {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    const rawModels = parseOpenAIStyleModels(data);

    const ids = new Set();
    for (const model of rawModels) { const id = model?.id || model?.name || model?.model; if (typeof id === "string" && id.trim() !== "") ids.add(id); }
    return Array.from(ids);
  } catch {
    return [];
  }
}

// Provider matches kindFilter when its serviceKinds intersect the requested kinds.
// LLM is the default kind for providers missing serviceKinds.
function providerMatchesKinds(providerId, kindFilterSet) {
  const provider = AI_PROVIDERS[providerId];
  const kinds = Array.isArray(provider?.serviceKinds) && provider.serviceKinds.length > 0
    ? provider.serviceKinds
    : [LLM_KIND];
  return kinds.some((k) => kindFilterSet.has(k));
}

// Combo matches kindFilter when its `kind` field is in the list.
// Combos with no kind are treated as LLM.
function comboMatchesKinds(combo, kindFilterSet) {
  const kind = combo?.kind || LLM_KIND;
  return kindFilterSet.has(kind);
}

/**
 * Resolve models for a single provider connection.
 * Extracted from buildModelsList so providers can be resolved in parallel.
 */
async function resolveProviderModels(providerId, conn, {
  kindFilterSet, customModels, modelAliases, isDisabled,
}) {
  const staticAlias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  const outputAlias = (
    conn?.providerSpecificData?.prefix
    || getProviderAlias(providerId)
    || staticAlias
  ).trim();
  const providerModels = PROVIDER_MODELS[staticAlias] || [];
  const enabledModels = conn?.providerSpecificData?.enabledModels;
  const hasExplicitEnabledModels =
    Array.isArray(enabledModels) && enabledModels.length > 0;
  const isCompatibleProvider =
    isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

  const staticModelKindById = new Map(
    providerModels.map((m) => [m.id, modelKind(m)])
  );
  let liveModelKindById = new Map();
  let liveCapabilitiesById = new Map();

  let rawModelIds = hasExplicitEnabledModels
    ? Array.from(
        new Set(
          enabledModels.filter(
            (modelId) => typeof modelId === "string" && modelId.trim() !== "",
          ),
        ),
      )
    : providerModels.map((model) => model.id);

  // Parallel: fetch upstream model list and resolve live catalog concurrently
  const shouldFetchCompatible = isCompatibleProvider && rawModelIds.length === 0 && !UPSTREAM_CONNECTION_RE.test(providerId);
  const liveResolver = LIVE_MODEL_RESOLVERS[providerId];
  const shouldFetchLive = liveResolver && !hasExplicitEnabledModels;

  if (shouldFetchCompatible || shouldFetchLive) {
    const [compatibleResult, liveResult] = await Promise.all([
      shouldFetchCompatible ? fetchCompatibleModelIds(conn) : Promise.resolve(null),
      shouldFetchLive
        ? liveResolver(conn).catch((err) => {
            console.log(`Live model fetch failed for ${providerId}: ${err?.message || err}`);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (compatibleResult?.length) rawModelIds = compatibleResult;

    if (liveResult?.models?.length) {
      rawModelIds = liveResult.models.map((m) => m.id);
      liveModelKindById = new Map();
      liveCapabilitiesById = new Map();
      for (const m of liveResult.models) {
        if (m?.id) liveModelKindById.set(m.id, modelKind(m));
        if (m?.id && m.capabilities) liveCapabilitiesById.set(m.id, m.capabilities);
      }
    }
  }

  const modelIds = [];
  for (const rawId of rawModelIds) {
    let modelId = rawId;
    if (modelId.startsWith(`${outputAlias}/`)) modelId = modelId.slice(outputAlias.length + 1);
    else if (modelId.startsWith(`${staticAlias}/`)) modelId = modelId.slice(staticAlias.length + 1);
    else if (modelId.startsWith(`${providerId}/`)) modelId = modelId.slice(providerId.length + 1);
    if (typeof modelId === "string" && modelId.trim() !== "") modelIds.push(modelId);
  }

  const customModelKindById = new Map();
  const customModelIds = [];
  for (const m of customModels) {
    if (!m?.id) continue;
    const kind = getModelKind(m) || LLM_KIND;
    if (!kindFilterSet.has(kind) && !(kind === "imageToText" && kindFilterSet.has(LLM_KIND))) continue;
    const alias = m.providerAlias;
    if (alias !== staticAlias && alias !== outputAlias && alias !== providerId) continue;
    const modelId = String(m.id).trim();
    if (modelId) { customModelKindById.set(modelId, getModelKind(m) || LLM_KIND); customModelIds.push(modelId); }
  }

  const aliasModelIds = [];
  for (const fullModel of Object.values(modelAliases || {})) {
    // eslint-disable-next-line react-doctor/js-set-map-lookups -- string indexOf, not array lookup
    if (typeof fullModel !== "string" || fullModel.indexOf("/") === -1) continue;
    if (!(fullModel.startsWith(`${outputAlias}/`) || fullModel.startsWith(`${staticAlias}/`) || fullModel.startsWith(`${providerId}/`))) continue;
    let modelId;
    if (fullModel.startsWith(`${outputAlias}/`)) modelId = fullModel.slice(outputAlias.length + 1);
    else if (fullModel.startsWith(`${staticAlias}/`)) modelId = fullModel.slice(staticAlias.length + 1);
    else if (fullModel.startsWith(`${providerId}/`)) modelId = fullModel.slice(providerId.length + 1);
    else modelId = fullModel;
    if (typeof modelId === "string" && modelId.trim() !== "") aliasModelIds.push(modelId);
  }

  const mergedModelIds = Array.from(new Set([...modelIds, ...customModelIds, ...aliasModelIds]));

  const out = [];
  for (const modelId of mergedModelIds) {
    const customKind = customModelKindById.get(modelId);
    const liveKind = liveModelKindById.get(modelId);
    const kind = customKind || liveKind || staticModelKindById.get(modelId) || inferKindFromUnknownModelId(modelId);
    const allowAsLlm = kind === "imageToText" && kindFilterSet.has(LLM_KIND);
    if (!kindFilterSet.has(kind) && !allowAsLlm) continue;
    if (isDisabled(outputAlias, modelId) || isDisabled(staticAlias, modelId)) continue;

    const model = {
      id: `${outputAlias}/${modelId}`,
      object: "model",
      owned_by: outputAlias,
    };
    const caps = liveCapabilitiesById.get(modelId) || capabilitiesFromServiceKind(customKind || liveKind);
    if (caps) model.capabilities = caps;
    out.push(model);
  }

  const providerInfo = AI_PROVIDERS[providerId];
  if (kindFilterSet.has("webSearch") && providerInfo?.searchConfig) {
    out.push({
      id: `${outputAlias}/search`,
      object: "model",
      kind: "webSearch",
      owned_by: outputAlias,
    });
  }
  if (kindFilterSet.has("webFetch") && providerInfo?.fetchConfig) {
    out.push({
      id: `${outputAlias}/fetch`,
      object: "model",
      kind: "webFetch",
      owned_by: outputAlias,
    });
  }

  return out;
}

/**
 * Build OpenAI-format models list filtered by service kinds.
 * @param {string[]} kindFilter - List of service kinds to include (e.g. ["llm"], ["webSearch","webFetch"]).
 */
export async function buildModelsList(kindFilter) {
  const kindFilterSet = new Set(kindFilter);
  let connections = [];
  try {
    connections = await getProviderConnections();
    connections = connections.filter(c => c.isActive !== false);
  } catch (e) {
    console.log("Could not fetch providers, returning all models");
  }

  let combos = [];
  try {
    combos = await getCombos();
  } catch (e) {
    console.log("Could not fetch combos");
  }

  let customModels = [];
  try {
    customModels = await getCustomModels();
  } catch (e) {
    console.log("Could not fetch custom models");
  }

  let modelAliases = {};
  try {
    modelAliases = await getModelAliases();
  } catch (e) {
    console.log("Could not fetch model aliases");
  }

  let disabledByAlias = {};
  try {
    disabledByAlias = await getDisabledModels();
  } catch (e) {
    console.log("Could not fetch disabled models");
  }
  const disabledSetsByAlias = {};
  for (const [alias, ids] of Object.entries(disabledByAlias)) {
    if (Array.isArray(ids)) disabledSetsByAlias[alias] = new Set(ids);
  }
  const isDisabled = (alias, modelId) => disabledSetsByAlias[alias]?.has(modelId) ?? false;

  const activeConnectionByProvider = new Map();
  for (const conn of connections) {
    if (!activeConnectionByProvider.has(conn.provider)) {
      activeConnectionByProvider.set(conn.provider, conn);
    }
  }

  const models = [];

  // Combos first (filtered by kind). Web combos expose `kind` so AI knows search vs fetch.
  for (const combo of combos) {
    if (!comboMatchesKinds(combo, kindFilterSet)) continue;
    const entry = {
      id: combo.name,
      object: "model",
      owned_by: "combo",
    };
    if (combo.kind === "webSearch" || combo.kind === "webFetch") {
      entry.kind = combo.kind;
    }
    models.push(entry);
  }

  if (connections.length === 0) {
    // DB unavailable -> return static models, filtered by per-model kind
    const aliasToProviderId = Object.fromEntries(
      Object.entries(PROVIDER_ID_TO_ALIAS).map(([id, alias]) => [alias, id])
    );
    for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
      const providerId = aliasToProviderId[alias] || alias;
      if (!providerMatchesKinds(providerId, kindFilterSet)) continue;
      for (const model of providerModels) {
        if (!kindFilterSet.has(modelKind(model))) continue;
        if (isDisabled(alias, model.id)) continue;
        models.push({
          id: `${alias}/${model.id}`,
          object: "model",
          owned_by: alias,
        });
      }
    }

    for (const customModel of customModels) {
      if (!customModel?.id || (customModel.type && customModel.type !== "llm")) continue;
      // Custom models without active connection are LLM-only by current schema
      if (!kindFilterSet.has(LLM_KIND)) continue;
      const providerAlias = customModel.providerAlias;
      if (!providerAlias) continue;

      const modelId = String(customModel.id).trim();
      if (!modelId) continue;

      models.push({
        id: `${providerAlias}/${modelId}`,
        object: "model",
        owned_by: providerAlias,
      });
    }
  } else {
    // Providers are independent — resolve all in parallel
    const providerResults = await Promise.all(
      Array.from(activeConnectionByProvider.entries())
        .flatMap(([providerId, conn]) =>
          providerMatchesKinds(providerId, kindFilterSet)
            ? [resolveProviderModels(providerId, conn, {
                kindFilterSet, customModels, modelAliases, isDisabled,
              })]
            : []
        )
    );
    models.push(...providerResults.flat());
  }

  const dedupedModels = [];
  const seenModelIds = new Set();
  for (const model of models) {
    if (!model?.id || seenModelIds.has(model.id)) continue;
    seenModelIds.add(model.id);
    dedupedModels.push(model);
  }

  return dedupedModels;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * GET /v1/models - OpenAI compatible models list (LLM/chat models only by default).
 * For other capabilities use /v1/models/{kind} (image, tts, stt, embedding, image-to-text, web).
 */
export async function GET() {
  try {
    const data = await buildModelsList([LLM_KIND]);
    return Response.json({ object: "list", data }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 }
    );
  }
}
