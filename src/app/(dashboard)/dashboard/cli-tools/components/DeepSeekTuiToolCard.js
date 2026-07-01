"use client";

import { useState, useRef, useMemo, useReducer } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const ENDPOINT = "/api/cli-tools/deepseek-tui-settings";

const normalizeLocalhost = (url) => url.replace("://localhost", "://127.0.0.1");

const getLocalBaseUrl = () => {
  if (typeof window !== "undefined") {
    return normalizeLocalhost(window.location.origin);
  }
  return "http://127.0.0.1:20128";
};

const getEffectiveBaseUrl = (customBaseUrl) => {
  const url = customBaseUrl || getLocalBaseUrl();
  return url.endsWith("/v1") ? url : `${url}/v1`;
};

// ── Sub-components ──────────────────────────────────────────────────────────

function ToolHeader({ tool, configStatus, isExpanded, handleToggle, handleToggleKeyDown }) {
  return (
    <button
      type="button"
      className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center"
      onClick={handleToggle}
      onKeyDown={handleToggleKeyDown}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image src={tool.image || "/providers/deepseek-tui.png"} alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
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

function DeepSeekStatusIndicator({ checking, deepseekStatus, setShowManualConfigModal }) {
  return (
    <>
      {checking && (
        <div className="flex items-center gap-2 text-text-muted">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span>Checking DeepSeek TUI...</span>
        </div>
      )}

      {!checking && deepseekStatus && !deepseekStatus.installed && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-yellow-500">warning</span>
              <div className="flex-1">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">DeepSeek TUI not detected locally</p>
                <p className="text-sm text-text-muted mt-1">Install via npm:</p>
                <code className="block mt-2 p-2 bg-black/20 rounded text-xs font-mono">npm install -g deepseek-tui</code>
                <p className="text-sm text-text-muted mt-2">Manual configuration is still available if 9router is deployed on a remote server.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-9">
              <Button variant="secondary" size="sm" onClick={() => setShowManualConfigModal(true)} className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30">
                <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
                Manual Config
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DeepSeekConfigFields({
  tool, deepseekStatus, message, form, dispatch, hasActiveProviders,
  apiKeys, cloudEnabled, activeProviders, modelAliases, tunnelEnabled,
  tunnelPublicUrl, tailscaleEnabled, tailscaleUrl,
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {tool.notes && tool.notes.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {tool.notes.map((note, idx) => (
              <div key={`${note.type}-${note.text}-${idx}`} className={`flex items-start gap-2 p-2 rounded text-xs ${
                note.type === "warning" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
                note.type === "error" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                <span className="material-symbols-outlined text-[14px] mt-0.5">
                  {note.type === "warning" ? "warning" : note.type === "error" ? "error" : "info"}
                </span>
                <span>{note.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <BaseUrlSelect
            value={form.customBaseUrl || getEffectiveBaseUrl(form.customBaseUrl)}
            onChange={(v) => dispatch({ type: 'setCustomBaseUrl', value: v })}
            requiresExternalUrl={tool.requiresExternalUrl}
            tunnelEnabled={tunnelEnabled}
            tunnelPublicUrl={tunnelPublicUrl}
            tailscaleEnabled={tailscaleEnabled}
            tailscaleUrl={tailscaleUrl}
          />
        </div>

        {deepseekStatus?.settings?.["providers.openai"]?.base_url && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
            <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
            <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
            <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
              {deepseekStatus.settings["providers.openai"].base_url}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <ApiKeySelect value={form.selectedApiKey} onChange={(v) => dispatch({ type: 'setSelectedApiKey', value: v })} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Default Model</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <div className="relative w-full min-w-0">
            <input
              type="text"
              value={form.selectedModel}
              onChange={(e) => dispatch({ type: 'setSelectedModel', value: e.target.value })}
              placeholder="provider/model-id"
              aria-label="Default Model"
              className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
            />
            {form.selectedModel && <button type="button" onClick={() => dispatch({ type: 'setSelectedModel', value: "" })} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
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
    </>
  );
}

function DeepSeekActionButtons({ handleApply, handleReset, applying, restoring, selectedModel, deepseekStatus, setShowManualConfigModal }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
      <Button variant="primary" size="sm" onClick={handleApply} disabled={!selectedModel} loading={applying}>
        <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
      </Button>
      <Button variant="outline" size="sm" onClick={handleReset} disabled={!deepseekStatus?.has9Router} loading={restoring}>
        <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
        <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
      </Button>
    </div>
  );
}

// ── Reducer ─────────────────────────────────────────────────────────────────

const statusReducer = (state, action) => {
  switch (action.type) {
    case 'setDeepseekStatus': return { ...state, deepseekStatus: action.value };
    case 'setChecking': return { ...state, checking: action.value };
    case 'setApplying': return { ...state, applying: action.value };
    case 'setRestoring': return { ...state, restoring: action.value };
    case 'setMessage': return { ...state, message: action.value };
    default: return state;
  }
};

const formReducer = (state, action) => {
  switch (action.type) {
    case 'setSelectedApiKey': return { ...state, selectedApiKey: action.value };
    case 'setSelectedModel': return { ...state, selectedModel: action.value };
    case 'setCustomBaseUrl': return { ...state, customBaseUrl: action.value };
    case 'setModalOpen': return { ...state, modalOpen: action.value };
    case 'setShowManualConfigModal': return { ...state, showManualConfigModal: action.value };
    case 'resetForm': return { ...state, message: null, selectedModel: "", customBaseUrl: "" };
    default: return state;
  }
};

// ── Main component ──────────────────────────────────────────────────────────

export default function DeepSeekTuiToolCard({
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
  const initialModel = initialStatus?.installed
    ? initialStatus.settings?.["providers.openai"]?.model || ""
    : "";

  const [status, statusDispatch] = useReducer(statusReducer, {
    deepseekStatus: initialStatus || null,
    checking: false,
    applying: false,
    restoring: false,
    message: null,
  });

  const [form, formDispatch] = useReducer(formReducer, {
    selectedApiKey: apiKeys?.[0]?.key || "",
    selectedModel: initialModel,
    modalOpen: false,
    showManualConfigModal: false,
    customBaseUrl: "",
  });

  const [modelAliases, setModelAliases] = useState({});

  const { deepseekStatus, checking, applying, restoring, message } = status;
  const { selectedApiKey, selectedModel, modalOpen, showManualConfigModal, customBaseUrl } = form;

  const configStatus = useMemo(() => {
    if (!deepseekStatus?.installed) return null;
    const openaiSection = deepseekStatus.settings?.["providers.openai"];
    if (!openaiSection?.base_url) return "not_configured";
    if (matchKnownEndpoint(openaiSection.base_url, { tunnelPublicUrl, tailscaleUrl })) return "configured";
    return "other";
  }, [deepseekStatus, tunnelPublicUrl, tailscaleUrl]);

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  const checkStatus = async () => {
    statusDispatch({ type: 'setChecking', value: true });
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      statusDispatch({ type: 'setDeepseekStatus', value: data });
    } catch (error) {
      statusDispatch({ type: 'setDeepseekStatus', value: { installed: false, error: error.message } });
    } finally {
      statusDispatch({ type: 'setChecking', value: false });
    }
  };

  const fetchedForExpansion = useRef(false);
  const handleToggle = () => {
    if (!isExpanded && !fetchedForExpansion.current) {
      fetchedForExpansion.current = true;
      if (!deepseekStatus) {
        statusDispatch({ type: 'setChecking', value: true });
        fetch(ENDPOINT)
          .then((r) => r.json())
          .then((data) => statusDispatch({ type: 'setDeepseekStatus', value: data }))
          .catch((error) => statusDispatch({ type: 'setDeepseekStatus', value: { installed: false, error: error.message } }))
          .finally(() => statusDispatch({ type: 'setChecking', value: false }));
      }
      fetch("/api/models/alias")
        .then((r) => r.json())
        .then((data) => { if (data) setModelAliases(data.aliases || {}); })
        .catch(() => {});
    }
    onToggle();
  };

  const handleApply = async () => {
    statusDispatch({ type: 'setApplying', value: true });
    statusDispatch({ type: 'setMessage', value: null });
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(customBaseUrl),
          apiKey: keyToUse,
          model: selectedModel,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        statusDispatch({ type: 'setMessage', value: { type: "success", text: "Settings applied successfully!" } });
        checkStatus();
      } else {
        statusDispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to apply settings" } });
      }
    } catch (error) {
      statusDispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      statusDispatch({ type: 'setApplying', value: false });
    }
  };

  const handleReset = async () => {
    statusDispatch({ type: 'setRestoring', value: true });
    statusDispatch({ type: 'setMessage', value: null });
    try {
      const res = await fetch(ENDPOINT, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        statusDispatch({ type: 'setMessage', value: { type: "success", text: "Settings reset successfully!" } });
        formDispatch({ type: 'resetForm' });
        checkStatus();
      } else {
        statusDispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      statusDispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      statusDispatch({ type: 'setRestoring', value: false });
    }
  };

  const handleModelSelect = (model) => {
    formDispatch({ type: 'setSelectedModel', value: model.value });
    formDispatch({ type: 'setModalOpen', value: false });
  };

  const handleToggleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim())
      ? selectedApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");

    const tomlContent = `[providers.openai]
base_url = "${getEffectiveBaseUrl(customBaseUrl)}"
api_key = "${keyToUse}"
model = "${selectedModel || "provider/model-id"}"
`;

    return [
      { filename: "~/.deepseek/config.toml", content: tomlContent },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <ToolHeader tool={tool} configStatus={configStatus} isExpanded={isExpanded} handleToggle={handleToggle} handleToggleKeyDown={handleToggleKeyDown} />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          <DeepSeekStatusIndicator checking={checking} deepseekStatus={deepseekStatus} setShowManualConfigModal={(v) => formDispatch({ type: 'setShowManualConfigModal', value: v })} />

          {!checking && deepseekStatus?.installed && (
            <>
              <DeepSeekConfigFields
                tool={tool}
                deepseekStatus={deepseekStatus}
                message={message}
                form={form}
                dispatch={formDispatch}
                hasActiveProviders={hasActiveProviders}
                apiKeys={apiKeys}
                cloudEnabled={cloudEnabled}
                activeProviders={activeProviders}
                modelAliases={modelAliases}
                tunnelEnabled={tunnelEnabled}
                tunnelPublicUrl={tunnelPublicUrl}
                tailscaleEnabled={tailscaleEnabled}
                tailscaleUrl={tailscaleUrl}
              />
              <DeepSeekActionButtons
                handleApply={handleApply}
                handleReset={handleReset}
                applying={applying}
                restoring={restoring}
                selectedModel={selectedModel}
                deepseekStatus={deepseekStatus}
                setShowManualConfigModal={(v) => formDispatch({ type: 'setShowManualConfigModal', value: v })}
              />
            </>
          )}
        </div>
      )}

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => formDispatch({ type: 'setModalOpen', value: false })}
        onSelect={handleModelSelect}
        selectedModel={selectedModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Model for DeepSeek TUI"
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => formDispatch({ type: 'setShowManualConfigModal', value: false })}
        title="DeepSeek TUI - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
