"use client";

import { useReducer, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal, Tooltip } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

const initialState = {
  claudeStatus: null,
  checkingClaude: false,
  applying: false,
  restoring: false,
  message: null,
  showInstallGuide: false,
  modalOpen: false,
  currentEditingAlias: null,
  selectedApiKey: "",
  modelAliases: {},
  showManualConfigModal: false,
  customBaseUrl: "",
  ccFilterNaming: false,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "setClaudeStatus": return { ...state, claudeStatus: action.value };
    case "setCheckingClaude": return { ...state, checkingClaude: action.value };
    case "setApplying": return { ...state, applying: action.value };
    case "setRestoring": return { ...state, restoring: action.value };
    case "setMessage": return { ...state, message: action.value };
    case "setShowInstallGuide": return { ...state, showInstallGuide: action.value };
    case "setModalOpen": return { ...state, modalOpen: action.value };
    case "setCurrentEditingAlias": return { ...state, currentEditingAlias: action.value };
    case "setSelectedApiKey": return { ...state, selectedApiKey: action.value };
    case "setModelAliases": return { ...state, modelAliases: action.value };
    case "setShowManualConfigModal": return { ...state, showManualConfigModal: action.value };
    case "setCustomBaseUrl": return { ...state, customBaseUrl: action.value };
    case "setCcFilterNaming": return { ...state, ccFilterNaming: action.value };
    case "updateClaudeStatusSettings": return { ...state, claudeStatus: { ...state.claudeStatus, hasBackup: true, settings: { ...state.claudeStatus?.settings, env: action.env } } };
    default: return state;
  }
};

function ClaudeToolHeader({ tool, configStatus, isExpanded, onToggle }) {
  return (
    <button type="button" className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image src="/providers/claude.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm">{tool.name}</h3>
            {configStatus === "configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Connected</span>}
            {configStatus === "not_configured" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">Not configured</span>}
            {configStatus === "other" && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">Other</span>}
          </div>
          <p className="text-xs text-text-muted truncate">{tool.description}</p>
        </div>
      </div>
      <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
    </button>
  );
}

function ClaudeNotInstalledSection({ showInstallGuide, onToggleInstallGuide, onManualConfig }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-yellow-500">warning</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Claude CLI not detected locally</p>
            <p className="text-sm text-text-muted">Manual configuration is still available if 9router is deployed on a remote server.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-9">
          <Button variant="secondary" size="sm" onClick={onManualConfig} className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30">
            <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
            Manual Config
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleInstallGuide}>
            <span className="material-symbols-outlined text-[18px] mr-1">{showInstallGuide ? "expand_less" : "help"}</span>
            {showInstallGuide ? "Hide" : "How to Install"}
          </Button>
        </div>
      </div>
      {showInstallGuide && (
        <div className="p-4 bg-surface border border-border rounded-lg">
          <h4 className="font-medium mb-3">Installation Guide</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-text-muted mb-1">macOS / Linux / Windows:</p>
              <code className="block px-3 py-2 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">npm install -g @anthropic-ai/claude-code</code>
            </div>
            <p className="text-text-muted">After installation, run <code className="px-1 bg-black/5 dark:bg-white/5 rounded">claude</code> to verify.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaudeInstalledContent({
  customBaseUrl, onCustomBaseUrlChange, getEffectiveBaseUrl,
  claudeStatus, tool, modelMappings, onModelMappingChange,
  hasActiveProviders, effectiveApiKey, apiKeys, cloudEnabled,
  ccFilterNaming, onCcFilterNamingToggle,
  message, applying, restoring,
  onApply, onReset, onManualConfig,
  activeProviders, modelAliases, openModelSelector,
  tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl,
  onSelectedApiKeyChange,
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Endpoint (selector) */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <BaseUrlSelect
            value={customBaseUrl || getEffectiveBaseUrl()}
            onChange={onCustomBaseUrlChange}
            requiresExternalUrl={tool.requiresExternalUrl}
            tunnelEnabled={tunnelEnabled}
            tunnelPublicUrl={tunnelPublicUrl}
            tailscaleEnabled={tailscaleEnabled}
            tailscaleUrl={tailscaleUrl}
          />
        </div>

        {/* Current configured */}
        {claudeStatus?.settings?.env?.ANTHROPIC_BASE_URL && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
            <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
            <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
            <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
              {claudeStatus.settings.env.ANTHROPIC_BASE_URL}
            </span>
          </div>
        )}

        {/* API Key */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <ApiKeySelect value={effectiveApiKey} onChange={onSelectedApiKeyChange} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
        </div>

        {/* Model Mappings */}
        {tool.defaultModels.map((model) => (
          <div key={model.alias} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
            <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">{model.name}</span>
            <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
            <div className="relative w-full min-w-0">
              <input type="text" value={modelMappings[model.alias] || ""} onChange={(e) => onModelMappingChange(model.alias, e.target.value)} placeholder="provider/model-id" aria-label={model.name} className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
              {modelMappings[model.alias] && <button type="button" onClick={() => onModelMappingChange(model.alias, "")} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
            </div>
            <button type="button" onClick={() => openModelSelector(model.alias)} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select Model</button>
          </div>
        ))}

        {/* CC Filter Naming */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Filter naming</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <label htmlFor="ccFilterNaming" className="flex items-center gap-1.5 cursor-pointer select-none">
            <input id="ccFilterNaming" type="checkbox" checked={ccFilterNaming} onChange={onCcFilterNamingToggle} className="w-3.5 h-3.5 accent-primary cursor-pointer" />
            <span className="text-xs text-text-muted">Filter naming requests</span>
            <Tooltip text="Intercepts Claude Code's topic-naming requests and returns a fake response locally, saving API tokens.">
              <span className="material-symbols-outlined text-text-muted text-[14px] cursor-help">info</span>
            </Tooltip>
          </label>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
          <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <Button variant="primary" size="sm" onClick={onApply} disabled={!hasActiveProviders} loading={applying}>
          <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
        </Button>
        <Button variant="outline" size="sm" onClick={onReset} disabled={!claudeStatus?.has9Router} loading={restoring}>
          <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
        </Button>
        <Button variant="ghost" size="sm" onClick={onManualConfig}>
          <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
        </Button>
      </div>
    </>
  );
}

export default function ClaudeToolCard({
  tool,
  isExpanded,
  onToggle,
  activeProviders,
  modelMappings,
  onModelMappingChange,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  cloudEnabled,
  initialStatus,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
}) {
  const [{ claudeStatus, checkingClaude, applying, restoring, message, showInstallGuide, modalOpen, currentEditingAlias, selectedApiKey, modelAliases, showManualConfigModal, customBaseUrl, ccFilterNaming }, dispatch] =
    useReducer(reducer, initialStatus, (s) => ({ ...initialState, claudeStatus: s || null }));

  const effectiveApiKey = selectedApiKey || apiKeys?.[0]?.key || "";

  const configStatus = useMemo(() => {
    if (!claudeStatus?.installed) return null;
    const currentUrl = claudeStatus.settings?.env?.ANTHROPIC_BASE_URL;
    if (!currentUrl) return "not_configured";
    if (matchKnownEndpoint(currentUrl, { tunnelPublicUrl, tailscaleUrl, cloudUrl: cloudEnabled ? CLOUD_URL : null })) return "configured";
    return "other";
  }, [claudeStatus, tunnelPublicUrl, tailscaleUrl, cloudEnabled]);

  const hasInitializedModels = useRef(false);

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      if (!claudeStatus) {
        dispatch({ type: "setCheckingClaude", value: true });
        fetch("/api/cli-tools/claude-settings")
          .then((r) => r.json())
          .then((data) => {
            dispatch({ type: "setClaudeStatus", value: data });
            // Move derived state logic here (Pattern D)
            if (data?.installed && !hasInitializedModels.current) {
              hasInitializedModels.current = true;
              const env = data.settings?.env || {};
              tool.defaultModels.forEach((model) => {
                if (model.envKey) {
                  const value = env[model.envKey] || model.defaultValue || "";
                  if (value) onModelMappingChange(model.alias, value);
                }
              });
              const tokenFromFile = env.ANTHROPIC_AUTH_TOKEN;
              if (tokenFromFile && apiKeys?.some(k => k.key === tokenFromFile)) {
                dispatch({ type: "setSelectedApiKey", value: tokenFromFile });
              }
            }
          })
          .catch((error) => dispatch({ type: "setClaudeStatus", value: { installed: false, error: error.message } }))
          .finally(() => dispatch({ type: "setCheckingClaude", value: false }));
      }
      fetch("/api/models/alias")
        .then((r) => r.json())
        .then((data) => { if (data) dispatch({ type: "setModelAliases", value: data.aliases || {} }); })
        .catch(() => {});
    }
    onToggle();
  }, [isExpanded, onToggle, claudeStatus, apiKeys, tool.defaultModels, onModelMappingChange]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings", { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (!controller.signal.aborted) dispatch({ type: "setCcFilterNaming", value: !!data.ccFilterNaming }); })
      .catch((err) => { if (err.name !== "AbortError") {} });
    return () => controller.abort();
  }, []);

  const handleCcFilterNamingToggle = async (e) => {
    const value = e.target.checked;
    dispatch({ type: "setCcFilterNaming", value });
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ccFilterNaming: value }),
    }).catch(() => {});
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || baseUrl;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const handleApplySettings = async () => {
    dispatch({ type: "setApplying", value: true });
    dispatch({ type: "setMessage", value: null });
    try {
      const env = { ANTHROPIC_BASE_URL: getEffectiveBaseUrl() };

      // Get key from dropdown, fallback to first key or sk_9router for localhost
      const keyToUse = effectiveApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      if (keyToUse) {
        env.ANTHROPIC_AUTH_TOKEN = keyToUse;
      }

      tool.defaultModels.forEach((model) => {
        const targetModel = modelMappings[model.alias];
        if (targetModel && model.envKey) env[model.envKey] = targetModel;
      });
      const res = await fetch("/api/cli-tools/claude-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setMessage", value: { type: "success", text: "Settings applied successfully!" } });
        dispatch({ type: "updateClaudeStatusSettings", env });
      } else {
        dispatch({ type: "setMessage", value: { type: "error", text: data.error || "Failed to apply settings" } });
      }
    } catch (error) {
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setApplying", value: false });
    }
  };

  const handleResetSettings = async () => {
    dispatch({ type: "setRestoring", value: true });
    dispatch({ type: "setMessage", value: null });
    try {
      const res = await fetch("/api/cli-tools/claude-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setMessage", value: { type: "success", text: "Settings reset successfully!" } });
        tool.defaultModels.forEach((model) => onModelMappingChange(model.alias, model.defaultValue || ""));
        dispatch({ type: "setSelectedApiKey", value: "" });
      } else {
        dispatch({ type: "setMessage", value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setRestoring", value: false });
    }
  };

  const openModelSelector = (alias) => {
    dispatch({ type: "setCurrentEditingAlias", value: alias });
    dispatch({ type: "setModalOpen", value: true });
  };

  const handleModelSelect = (model) => {
    if (currentEditingAlias) onModelMappingChange(currentEditingAlias, model.value);
  };

  // Generate settings.json content for manual copy
  const getManualConfigs = () => {
    const keyToUse = (effectiveApiKey && effectiveApiKey.trim())
      ? effectiveApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");
    const env = { ANTHROPIC_BASE_URL: getEffectiveBaseUrl(), ANTHROPIC_AUTH_TOKEN: keyToUse };
    tool.defaultModels.forEach((model) => {
      const targetModel = modelMappings[model.alias];
      if (targetModel && model.envKey) env[model.envKey] = targetModel;
    });

    return [
      {
        filename: "~/.claude/settings.json",
        content: JSON.stringify({ hasCompletedOnboarding: true, env }, null, 2),
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <ClaudeToolHeader tool={tool} configStatus={configStatus} isExpanded={isExpanded} onToggle={handleToggle} />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingClaude && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking Claude CLI...</span>
            </div>
          )}

          {!checkingClaude && claudeStatus && !claudeStatus.installed && (
            <ClaudeNotInstalledSection
              showInstallGuide={showInstallGuide}
              onToggleInstallGuide={() => dispatch({ type: "setShowInstallGuide", value: !showInstallGuide })}
              onManualConfig={() => dispatch({ type: "setShowManualConfigModal", value: true })}
            />
          )}

          {!checkingClaude && claudeStatus?.installed && (
            <ClaudeInstalledContent
              customBaseUrl={customBaseUrl}
              onCustomBaseUrlChange={(value) => dispatch({ type: "setCustomBaseUrl", value })}
              getEffectiveBaseUrl={getEffectiveBaseUrl}
              claudeStatus={claudeStatus}
              tool={tool}
              modelMappings={modelMappings}
              onModelMappingChange={onModelMappingChange}
              hasActiveProviders={hasActiveProviders}
              effectiveApiKey={effectiveApiKey}
              apiKeys={apiKeys}
              cloudEnabled={cloudEnabled}
              ccFilterNaming={ccFilterNaming}
              onCcFilterNamingToggle={handleCcFilterNamingToggle}
              message={message}
              applying={applying}
              restoring={restoring}
              onApply={handleApplySettings}
              onReset={handleResetSettings}
              onManualConfig={() => dispatch({ type: "setShowManualConfigModal", value: true })}
              activeProviders={activeProviders}
              modelAliases={modelAliases}
              openModelSelector={openModelSelector}
              tunnelEnabled={tunnelEnabled}
              tunnelPublicUrl={tunnelPublicUrl}
              tailscaleEnabled={tailscaleEnabled}
              tailscaleUrl={tailscaleUrl}
              onSelectedApiKeyChange={(value) => dispatch({ type: "setSelectedApiKey", value })}
            />
          )}
        </div>
      )}

      <ModelSelectModal isOpen={modalOpen} onClose={() => dispatch({ type: "setModalOpen", value: false })} onSelect={handleModelSelect} selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null} activeProviders={activeProviders} modelAliases={modelAliases} title={`Select model for ${currentEditingAlias}`} />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => dispatch({ type: "setShowManualConfigModal", value: false })}
        title="Claude CLI - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
