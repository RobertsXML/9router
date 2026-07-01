"use client";

import { useReducer, useRef } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const initialState = {
  codexStatus: null,
  checkingCodex: false,
  applying: false,
  restoring: false,
  message: null,
  showInstallGuide: false,
  selectedApiKey: "",
  selectedModel: "",
  subagentModel: "",
  modalOpen: false,
  subagentModalOpen: false,
  modelAliases: {},
  showManualConfigModal: false,
  customBaseUrl: "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case "setCodexStatus": return { ...state, codexStatus: action.value };
    case "setCheckingCodex": return { ...state, checkingCodex: action.value };
    case "setApplying": return { ...state, applying: action.value };
    case "setRestoring": return { ...state, restoring: action.value };
    case "setMessage": return { ...state, message: action.value };
    case "setShowInstallGuide": return { ...state, showInstallGuide: action.value };
    case "setSelectedApiKey": return { ...state, selectedApiKey: action.value };
    case "setSelectedModel": return { ...state, selectedModel: action.value };
    case "setSubagentModel": return { ...state, subagentModel: action.value };
    case "setModalOpen": return { ...state, modalOpen: action.value };
    case "setSubagentModalOpen": return { ...state, subagentModalOpen: action.value };
    case "setModelAliases": return { ...state, modelAliases: action.value };
    case "setShowManualConfigModal": return { ...state, showManualConfigModal: action.value };
    case "setCustomBaseUrl": return { ...state, customBaseUrl: action.value };
    default: return state;
  }
};

function CodexToolHeader({ tool, configStatus, isExpanded, onToggle }) {
  return (
    <button type="button" className="flex w-full items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image src="/providers/codex.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
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

function CodexNotInstalledSection({ showInstallGuide, onToggleInstallGuide, onManualConfig }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-yellow-500">warning</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Codex CLI not detected locally</p>
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
              <code className="block px-3 py-2 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">npm install -g @openai/codex</code>
            </div>
            <p className="text-text-muted">After installation, run <code className="px-1 bg-black/5 dark:bg-white/5 rounded">codex</code> to verify.</p>
            <div className="pt-2 border-t border-border">
              <p className="text-text-muted text-xs">
                Codex uses <code className="px-1 bg-black/5 dark:bg-white/5 rounded">~/.codex/auth.json</code> with <code className="px-1 bg-black/5 dark:bg-white/5 rounded">OPENAI_API_KEY</code>.
                Click &quot;Apply&quot; to auto-configure.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CodexInstalledContent({
  customBaseUrl, onCustomBaseUrlChange, displayUrl,
  codexStatus, selectedApiKey, onSelectedApiKeyChange,
  apiKeys, cloudEnabled,
  selectedModel, onSelectedModelChange,
  subagentModel, onSubagentModelChange,
  activeProviders, modelAliases,
  onOpenModelSelector, onOpenSubagentModelSelector,
  message, applying, restoring,
  onApply, onReset, onManualConfig,
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Endpoint (selector) */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <BaseUrlSelect
            value={customBaseUrl || displayUrl}
            onChange={onCustomBaseUrlChange}
          />
        </div>

        {/* Current configured */}
        {codexStatus?.config && (() => {
          const parsed = codexStatus.config.match(/base_url\s*=\s*"([^"]+)"/);
          const currentBaseUrl = parsed ? parsed[1] : null;
          return currentBaseUrl ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
              <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
              <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
              <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
                {currentBaseUrl}
              </span>
            </div>
          ) : null;
        })()}

        {/* API Key */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <ApiKeySelect value={selectedApiKey} onChange={onSelectedApiKeyChange} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
        </div>

        {/* Model */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Model</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <div className="relative w-full min-w-0">
            <input type="text" value={selectedModel} onChange={(e) => onSelectedModelChange(e.target.value)} placeholder="provider/model-id" aria-label="Model" className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
            {selectedModel && <button type="button" onClick={() => onSelectedModelChange("")} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
          </div>
          <button type="button" onClick={onOpenModelSelector} disabled={!activeProviders?.length} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${activeProviders?.length ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select Model</button>
        </div>

        {/* Subagent Model */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Subagent Model</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <div className="relative w-full min-w-0">
            <input
              type="text"
              value={subagentModel}
              onChange={(e) => onSubagentModelChange(e.target.value)}
              placeholder={selectedModel || "provider/model-id (defaults to main model)"}
              aria-label="Subagent Model"
              className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
            />
            {subagentModel && (
              <button
                type="button"
                onClick={() => onSubagentModelChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors"
                title="Clear (will use main model)"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenSubagentModelSelector}
            disabled={!activeProviders?.length}
            className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${activeProviders?.length ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
          >
            Select Model
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
          <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <Button variant="primary" size="sm" onClick={onApply} disabled={(!selectedApiKey && (cloudEnabled && apiKeys.length > 0)) || !selectedModel} loading={applying}>
          <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
        </Button>
        <Button variant="outline" size="sm" onClick={onReset} disabled={restoring} loading={restoring}>
          <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
        </Button>
        <Button variant="ghost" size="sm" onClick={onManualConfig}>
          <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
        </Button>
      </div>
    </>
  );
}

export default function CodexToolCard({ tool, isExpanded, onToggle, baseUrl, apiKeys, activeProviders, cloudEnabled, initialStatus, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl }) {
  const [{ codexStatus, checkingCodex, applying, restoring, message, showInstallGuide, selectedApiKey, selectedModel, subagentModel, modalOpen, subagentModalOpen, modelAliases, showManualConfigModal, customBaseUrl }, dispatch] =
    useReducer(reducer, initialStatus, (s) => ({ ...initialState, codexStatus: s || null }));

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) dispatch({ type: "setModelAliases", value: data.aliases || {} });
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  const getConfigStatus = () => {
    if (!codexStatus?.installed) return null;
    if (!codexStatus.config) return "not_configured";
    const parsed = codexStatus.config.match(/base_url\s*=\s*"([^"]+)"/);
    const currentUrl = parsed ? parsed[1] : "";
    return matchKnownEndpoint(currentUrl, { tunnelPublicUrl, tailscaleUrl }) ? "configured" : "other";
  };

  const configStatus = getConfigStatus();

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || `${baseUrl}/v1`;
    // Ensure URL ends with /v1
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => customBaseUrl || `${baseUrl}/v1`;

  const checkCodexStatus = async () => {
    dispatch({ type: "setCheckingCodex", value: true });
    try {
      const res = await fetch("/api/cli-tools/codex-settings");
      const data = await res.json();
      dispatch({ type: "setCodexStatus", value: data });
      // Move derived state logic here (Pattern D)
      if (data?.config) {
        const modelMatch = data.config.match(/^model\s*=\s*"([^"]+)"/m);
        if (modelMatch) dispatch({ type: "setSelectedModel", value: modelMatch[1] });
        const subagentModelMatch = data.config.match(/\[agents\.subagent\]\s*\n\s*model\s*=\s*"([^"]+)"/m);
        if (subagentModelMatch) dispatch({ type: "setSubagentModel", value: subagentModelMatch[1] });
      }
    } catch (error) {
      dispatch({ type: "setCodexStatus", value: { installed: false, error: error.message } });
    } finally {
      dispatch({ type: "setCheckingCodex", value: false });
    }
  };

  const fetchedForExpansion = useRef(false);
  const handleToggle = () => {
    if (!isExpanded && !fetchedForExpansion.current) {
      fetchedForExpansion.current = true;
      if (!codexStatus) {
        dispatch({ type: "setCheckingCodex", value: true });
        fetch("/api/cli-tools/codex-settings")
          .then((r) => r.json())
          .then((data) => {
            dispatch({ type: "setCodexStatus", value: data });
            if (data?.config) {
              const modelMatch = data.config.match(/^model\s*=\s*"([^"]+)"/m);
              if (modelMatch) dispatch({ type: "setSelectedModel", value: modelMatch[1] });
              const subagentModelMatch = data.config.match(/\[agents\.subagent\]\s*\n\s*model\s*=\s*"([^"]+)"/m);
              if (subagentModelMatch) dispatch({ type: "setSubagentModel", value: subagentModelMatch[1] });
            }
          })
          .catch((error) => dispatch({ type: "setCodexStatus", value: { installed: false, error: error.message } }))
          .finally(() => dispatch({ type: "setCheckingCodex", value: false }));
      }
      fetch("/api/models/alias")
        .then((r) => r.json())
        .then((data) => { if (data) dispatch({ type: "setModelAliases", value: data.aliases || {} }); })
        .catch(() => {});
    }
    onToggle();
  };

  const handleApplySettings = async () => {
    dispatch({ type: "setApplying", value: true });
    dispatch({ type: "setMessage", value: null });
    try {
      // Use sk_9router for localhost if no key, otherwise use selected key
      const keyToUse = (selectedApiKey && selectedApiKey.trim())
        ? selectedApiKey
        : (!cloudEnabled ? "sk_9router" : selectedApiKey);

      const res = await fetch("/api/cli-tools/codex-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: selectedModel,
          subagentModel: subagentModel || selectedModel
        }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setMessage", value: { type: "success", text: "Settings applied successfully!" } });
        checkCodexStatus();
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
      const res = await fetch("/api/cli-tools/codex-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setMessage", value: { type: "success", text: "Settings reset successfully!" } });
        dispatch({ type: "setSelectedModel", value: "" });
        dispatch({ type: "setSubagentModel", value: "" });
        checkCodexStatus();
      } else {
        dispatch({ type: "setMessage", value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setRestoring", value: false });
    }
  };

  const handleModelSelect = (model) => {
    dispatch({ type: "setSelectedModel", value: model.value });
    // Auto-set subagent model if not set
    if (!subagentModel) {
      dispatch({ type: "setSubagentModel", value: model.value });
    }
    dispatch({ type: "setModalOpen", value: false });
  };

  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim())
      ? selectedApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");

    const effectiveSubagentModel = subagentModel || selectedModel;

    const configContent = `# 9Router Configuration for Codex CLI
model = "${selectedModel}"
model_provider = "9router"

[model_providers.9router]
name = "9Router"
base_url = "${getEffectiveBaseUrl()}"
wire_api = "responses"

[agents.subagent]
model = "${effectiveSubagentModel}"
`;

    const authContent = JSON.stringify({
      auth_mode: "apikey",
      OPENAI_API_KEY: keyToUse
    }, null, 2);

    return [
      {
        filename: "~/.codex/config.toml",
        content: configContent,
      },
      {
        filename: "~/.codex/auth.json",
        content: authContent,
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <CodexToolHeader tool={tool} configStatus={configStatus} isExpanded={isExpanded} onToggle={handleToggle} />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingCodex && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking Codex CLI...</span>
            </div>
          )}

          {!checkingCodex && codexStatus && !codexStatus.installed && (
            <CodexNotInstalledSection
              showInstallGuide={showInstallGuide}
              onToggleInstallGuide={() => dispatch({ type: "setShowInstallGuide", value: !showInstallGuide })}
              onManualConfig={() => dispatch({ type: "setShowManualConfigModal", value: true })}
            />
          )}

          {!checkingCodex && codexStatus?.installed && (
            <CodexInstalledContent
              customBaseUrl={customBaseUrl}
              onCustomBaseUrlChange={(value) => dispatch({ type: "setCustomBaseUrl", value })}
              displayUrl={getDisplayUrl()}
              codexStatus={codexStatus}
              selectedApiKey={selectedApiKey}
              onSelectedApiKeyChange={(value) => dispatch({ type: "setSelectedApiKey", value })}
              apiKeys={apiKeys}
              cloudEnabled={cloudEnabled}
              selectedModel={selectedModel}
              onSelectedModelChange={(value) => dispatch({ type: "setSelectedModel", value })}
              subagentModel={subagentModel}
              onSubagentModelChange={(value) => dispatch({ type: "setSubagentModel", value })}
              activeProviders={activeProviders}
              modelAliases={modelAliases}
              onOpenModelSelector={() => dispatch({ type: "setModalOpen", value: true })}
              onOpenSubagentModelSelector={() => dispatch({ type: "setSubagentModalOpen", value: true })}
              message={message}
              applying={applying}
              restoring={restoring}
              onApply={handleApplySettings}
              onReset={handleResetSettings}
              onManualConfig={() => dispatch({ type: "setShowManualConfigModal", value: true })}
            />
          )}
        </div>
      )}

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => dispatch({ type: "setModalOpen", value: false })}
        onSelect={handleModelSelect}
        selectedModel={selectedModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Model for Codex"
      />

      <ModelSelectModal
        isOpen={subagentModalOpen}
        onClose={() => dispatch({ type: "setSubagentModalOpen", value: false })}
        onSelect={(model) => { dispatch({ type: "setSubagentModel", value: model.value }); dispatch({ type: "setSubagentModalOpen", value: false }); }}
        selectedModel={subagentModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Subagent Model for Codex"
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => dispatch({ type: "setShowManualConfigModal", value: false })}
        title="Codex CLI - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
