"use client";

import { useReducer, useCallback, useMemo } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const ENDPOINT = "/api/cli-tools/hermes-settings";

const normalizeLocalhost = (url) => url.replace("://localhost", "://127.0.0.1");

const getLocalBaseUrl = () => {
  if (typeof window !== "undefined") {
    return normalizeLocalhost(window.location.origin);
  }
  return "http://127.0.0.1:20128";
};

const initialState = {
  hermesStatus: null,
  checking: false,
  applying: false,
  restoring: false,
  message: null,
  selectedApiKey: "",
  selectedModel: "",
  modalOpen: false,
  modelAliases: {},
  showManualConfigModal: false,
  customBaseUrl: "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'setHermesStatus': return { ...state, hermesStatus: action.value };
    case 'setChecking': return { ...state, checking: action.value };
    case 'setApplying': return { ...state, applying: action.value };
    case 'setRestoring': return { ...state, restoring: action.value };
    case 'setMessage': return { ...state, message: action.value };
    case 'setSelectedApiKey': return { ...state, selectedApiKey: action.value };
    case 'setSelectedModel': return { ...state, selectedModel: action.value };
    case 'setModalOpen': return { ...state, modalOpen: action.value };
    case 'setModelAliases': return { ...state, modelAliases: action.value };
    case 'setShowManualConfigModal': return { ...state, showManualConfigModal: action.value };
    case 'setCustomBaseUrl': return { ...state, customBaseUrl: action.value };
    case 'reset': return initialState;
    default: return state;
  }
};

export default function HermesToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  activeProviders,
  cloudEnabled,
  initialStatus,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
}) {
  const [{ hermesStatus, checking, applying, restoring, message, selectedApiKey, selectedModel, modalOpen, modelAliases, showManualConfigModal, customBaseUrl }, dispatch] = useReducer(reducer, initialStatus, (init) => ({
    ...initialState,
    hermesStatus: init || null,
    selectedModel: init?.settings?.model?.default || "",
  }));

  const configStatus = useMemo(() => {
    if (!hermesStatus?.installed) return null;
    const cfg = hermesStatus.settings?.model;
    if (!cfg?.base_url) return "not_configured";
    if (matchKnownEndpoint(cfg.base_url, { tunnelPublicUrl, tailscaleUrl })) return "configured";
    return "other";
  }, [hermesStatus, tunnelPublicUrl, tailscaleUrl]);

  const fetchModelAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) dispatch({ type: 'setModelAliases', value: data.aliases || {} });
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    dispatch({ type: 'setChecking', value: true });
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      dispatch({ type: 'setHermesStatus', value: data });
    } catch (error) {
      dispatch({ type: 'setHermesStatus', value: { installed: false, error: error.message } });
    } finally {
      dispatch({ type: 'setChecking', value: false });
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      if (!hermesStatus) checkStatus();
      fetchModelAliases();
    }
    onToggle();
  }, [isExpanded, onToggle, hermesStatus, checkStatus, fetchModelAliases]);

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const handleApply = async () => {
    dispatch({ type: 'setApplying', value: true });
    dispatch({ type: 'setMessage', value: null });
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setMessage', value: { type: "success", text: "Settings applied successfully!" } });
        checkStatus();
      } else {
        dispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to apply settings" } });
      }
    } catch (error) {
      dispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: 'setApplying', value: false });
    }
  };

  const handleReset = async () => {
    dispatch({ type: 'setRestoring', value: true });
    dispatch({ type: 'setMessage', value: null });
    try {
      const res = await fetch(ENDPOINT, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setMessage', value: { type: "success", text: "Settings reset successfully!" } });
        dispatch({ type: 'setSelectedModel', value: "" });
        checkStatus();
      } else {
        dispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      dispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: 'setRestoring', value: false });
    }
  };

  const handleModelSelect = (model) => {
    dispatch({ type: 'setSelectedModel', value: model.value });
    dispatch({ type: 'setModalOpen', value: false });
  };

  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim())
      ? selectedApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");

    const yamlContent = `model:\n  default: "${selectedModel || "provider/model-id"}"\n  provider: "custom"\n  base_url: "${getEffectiveBaseUrl()}"\n`;
    const envContent = `OPENAI_API_KEY=${keyToUse}\n`;

    return [
      { filename: "~/.hermes/config.yaml", content: yamlContent },
      { filename: "~/.hermes/.env", content: envContent },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <button type="button" className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={handleToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image src="/providers/hermes.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
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

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checking && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking Hermes Agent...</span>
            </div>
          )}

          {!checking && hermesStatus && !hermesStatus.installed && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-yellow-500">warning</span>
                  <div className="flex-1">
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">Hermes Agent not detected locally</p>
                    <p className="text-sm text-text-muted">Install: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-0 sm:pl-9">
                  <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'setShowManualConfigModal', value: true })} className="w-full sm:w-auto !bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30">
                    <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
                    Manual Config
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!checking && hermesStatus?.installed && (
            <>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                  <BaseUrlSelect
                    value={customBaseUrl || getEffectiveBaseUrl()}
                    onChange={(v) => dispatch({ type: 'setCustomBaseUrl', value: v })}
                    requiresExternalUrl={tool.requiresExternalUrl}
                    tunnelEnabled={tunnelEnabled}
                    tunnelPublicUrl={tunnelPublicUrl}
                    tailscaleEnabled={tailscaleEnabled}
                    tailscaleUrl={tailscaleUrl}
                  />
                </div>

                {hermesStatus?.settings?.model?.base_url && (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                    <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
                    <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                    <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
                      {hermesStatus.settings.model.base_url}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                  <ApiKeySelect value={selectedApiKey} onChange={(v) => dispatch({ type: 'setSelectedApiKey', value: v })} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Default Model</span>
                  <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                  <div className="relative w-full min-w-0">
                    <input type="text" value={selectedModel} onChange={(e) => dispatch({ type: 'setSelectedModel', value: e.target.value })} placeholder="provider/model-id" aria-label="Model ID" className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
                    {selectedModel && <button type="button" onClick={() => dispatch({ type: 'setSelectedModel', value: "" })} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
                  </div>
                  <button type="button" onClick={() => dispatch({ type: 'setModalOpen', value: true })} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select</button>
                </div>
              </div>

              {message && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                  <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
                  <span>{message.text}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleApply} disabled={!selectedModel} loading={applying} className="w-full sm:w-auto">
                  <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!hermesStatus?.has9Router} loading={restoring} className="w-full sm:w-auto">
                  <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'setShowManualConfigModal', value: true })} className="w-full sm:w-auto">
                  <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => dispatch({ type: 'setModalOpen', value: false })}
        onSelect={handleModelSelect}
        selectedModel={selectedModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Model for Hermes Agent"
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => dispatch({ type: 'setShowManualConfigModal', value: false })}
        title="Hermes Agent - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
