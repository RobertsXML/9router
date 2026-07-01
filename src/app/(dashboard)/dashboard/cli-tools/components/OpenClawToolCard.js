"use client";

import { useReducer, useRef, useCallback, useMemo } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const normalizeLocalhost = (url) => url.replace("://localhost", "://127.0.0.1");

const getLocalBaseUrl = () => {
  if (typeof window !== "undefined") {
    return normalizeLocalhost(window.location.origin);
  }
  return "http://127.0.0.1:20128";
};

const initialState = {
  openclawStatus: null,
  checkingOpenclaw: false,
  applying: false,
  restoring: false,
  message: null,
  selectedApiKey: "",
  selectedModel: "",
  agentModels: {},
  agentModalFor: null,
  modalOpen: false,
  modelAliases: {},
  showManualConfigModal: false,
  customBaseUrl: "",
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'setOpenclawStatus': return { ...state, openclawStatus: action.value };
    case 'setCheckingOpenclaw': return { ...state, checkingOpenclaw: action.value };
    case 'setApplying': return { ...state, applying: action.value };
    case 'setRestoring': return { ...state, restoring: action.value };
    case 'setMessage': return { ...state, message: action.value };
    case 'setSelectedApiKey': return { ...state, selectedApiKey: action.value };
    case 'setSelectedModel': return { ...state, selectedModel: action.value };
    case 'setAgentModels': return { ...state, agentModels: action.value };
    case 'setAgentModel': return { ...state, agentModels: { ...state.agentModels, [action.agentId]: action.value } };
    case 'setAgentModalFor': return { ...state, agentModalFor: action.value };
    case 'setModalOpen': return { ...state, modalOpen: action.value };
    case 'setModelAliases': return { ...state, modelAliases: action.value };
    case 'setShowManualConfigModal': return { ...state, showManualConfigModal: action.value };
    case 'setCustomBaseUrl': return { ...state, customBaseUrl: action.value };
    case 'reset': return initialState;
    default: return state;
  }
};

function OpenClawHeader({ tool, isExpanded, configStatus, onToggle }) {
  return (
    <button type="button" className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image src="/providers/openclaw.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
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

function OpenClawNotInstalled({ onManualConfig }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-yellow-500">warning</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Open Claw CLI not detected locally</p>
            <p className="text-sm text-text-muted">Manual configuration is still available if 9router is deployed on a remote server.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-9">
          <Button variant="secondary" size="sm" onClick={onManualConfig} className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30">
            <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
            Manual Config
          </Button>
        </div>
      </div>
    </div>
  );
}

function OpenClawSettingsForm({ state, dispatch, apiKeys, cloudEnabled, hasActiveProviders, getEffectiveBaseUrl, tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl, tool }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Endpoint (selector) */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <BaseUrlSelect
          value={state.customBaseUrl || getEffectiveBaseUrl()}
          onChange={(v) => dispatch({ type: 'setCustomBaseUrl', value: v })}
          requiresExternalUrl={tool.requiresExternalUrl}
          tunnelEnabled={tunnelEnabled}
          tunnelPublicUrl={tunnelPublicUrl}
          tailscaleEnabled={tailscaleEnabled}
          tailscaleUrl={tailscaleUrl}
        />
      </div>

      {/* Current configured */}
      {state.openclawStatus?.settings?.models?.providers?.["9router"]?.baseUrl && (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
            {state.openclawStatus.settings.models.providers["9router"].baseUrl}
          </span>
        </div>
      )}

      {/* API Key */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <ApiKeySelect value={state.selectedApiKey} onChange={(v) => dispatch({ type: 'setSelectedApiKey', value: v })} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
      </div>

      {/* Default Model */}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Default Model</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <div className="relative w-full min-w-0">
          <input type="text" value={state.selectedModel} onChange={(e) => dispatch({ type: 'setSelectedModel', value: e.target.value })} placeholder="provider/model-id" aria-label="Default Model" className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
          {state.selectedModel && <button type="button" onClick={() => dispatch({ type: 'setSelectedModel', value: "" })} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
        </div>
        <button type="button" onClick={() => { dispatch({ type: 'setAgentModalFor', value: null }); dispatch({ type: 'setModalOpen', value: true }); }} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select</button>
      </div>

      {/* Per-agent model overrides */}
      {(state.openclawStatus.agents || []).flatMap((agent) => agent.agentDir ? [
        <div key={agent.id} className="flex items-center gap-2 pl-4">
          <span className="w-32 shrink-0 text-xs text-primary text-right truncate" title={agent.name || agent.id}>Agent {agent.name || agent.id}</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <div className="relative w-full min-w-0">
            <input
              type="text"
              value={state.agentModels[agent.id] || ""}
              onChange={(e) => dispatch({ type: 'setAgentModel', agentId: agent.id, value: e.target.value })}
              placeholder={`default (${state.selectedModel || "provider/model-id"})`}
              aria-label={`Agent ${agent.name || agent.id} model`}
              className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
            />
            {state.agentModels[agent.id] && <button type="button" onClick={() => dispatch({ type: 'setAgentModel', agentId: agent.id, value: "" })} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors" title="Clear"><span className="material-symbols-outlined text-[14px]">close</span></button>}
          </div>
          <button type="button" onClick={() => { dispatch({ type: 'setAgentModalFor', value: agent.id }); dispatch({ type: 'setModalOpen', value: true }); }} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select</button>
        </div>
      ] : [])}
    </div>
  );
}

function OpenClawStatusMessage({ message }) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
      <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
      <span>{message.text}</span>
    </div>
  );
}

export default function OpenClawToolCard({
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
  const [state, dispatch] = useReducer(reducer, { ...initialState, openclawStatus: initialStatus || null });
  const hasInitializedFromStatus = useRef(false);

  const configStatus = useMemo(() => {
    if (!state.openclawStatus?.installed) return null;
    const currentProvider = state.openclawStatus.settings?.models?.providers?.["9router"];
    if (!currentProvider) return "not_configured";
    return matchKnownEndpoint(currentProvider.baseUrl, { tunnelPublicUrl, tailscaleUrl }) ? "configured" : "other";
  }, [state.openclawStatus, tunnelPublicUrl, tailscaleUrl]);

  const fetchModelAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) dispatch({ type: 'setModelAliases', value: data.aliases || {} });
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  }, []);

  const checkOpenclawStatus = useCallback(async () => {
    dispatch({ type: 'setCheckingOpenclaw', value: true });
    try {
      const res = await fetch("/api/cli-tools/openclaw-settings");
      const data = await res.json();
      dispatch({ type: 'setOpenclawStatus', value: data });
      // Init form values from status (once)
      if (data?.installed && !hasInitializedFromStatus.current) {
        hasInitializedFromStatus.current = true;
        const provider = data.settings?.models?.providers?.["9router"];
        if (provider) {
          const primaryModel = data.settings?.agents?.defaults?.model?.primary;
          if (primaryModel) dispatch({ type: 'setSelectedModel', value: primaryModel.replace("9router/", "") });
          if (provider.apiKey) dispatch({ type: 'setSelectedApiKey', value: provider.apiKey });
        }
        const agentList = data.agents || [];
        const initAgentModels = {};
        agentList.forEach((agent) => {
          if (agent.currentModel) initAgentModels[agent.id] = agent.currentModel;
        });
        dispatch({ type: 'setAgentModels', value: initAgentModels });
      }
    } catch (error) {
      dispatch({ type: 'setOpenclawStatus', value: { installed: false, error: error.message } });
    } finally {
      dispatch({ type: 'setCheckingOpenclaw', value: false });
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      if (!state.openclawStatus) checkOpenclawStatus();
      fetchModelAliases();
    }
    onToggle();
  }, [isExpanded, onToggle, state.openclawStatus, checkOpenclawStatus, fetchModelAliases]);

  const getEffectiveBaseUrl = useCallback(() => {
    const url = state.customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  }, [state.customBaseUrl]);

  const handleApplySettings = useCallback(async () => {
    dispatch({ type: 'setApplying', value: true });
    dispatch({ type: 'setMessage', value: null });
    try {
      const keyToUse = state.selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch("/api/cli-tools/openclaw-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: state.selectedModel,
          agentModels: state.agentModels,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setMessage', value: { type: "success", text: "Settings applied successfully!" } });
        checkOpenclawStatus();
      } else {
        dispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to apply settings" } });
      }
    } catch (error) {
      dispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: 'setApplying', value: false });
    }
  }, [state.selectedApiKey, apiKeys, cloudEnabled, state.selectedModel, state.agentModels, getEffectiveBaseUrl, checkOpenclawStatus]);

  const handleResetSettings = useCallback(async () => {
    dispatch({ type: 'setRestoring', value: true });
    dispatch({ type: 'setMessage', value: null });
    try {
      const res = await fetch("/api/cli-tools/openclaw-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setMessage', value: { type: "success", text: "Settings reset successfully!" } });
        dispatch({ type: 'setSelectedModel', value: "" });
        dispatch({ type: 'setSelectedApiKey', value: "" });
        checkOpenclawStatus();
      } else {
        dispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      dispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: 'setRestoring', value: false });
    }
  }, [checkOpenclawStatus]);

  const handleModelSelect = useCallback((model) => {
    if (state.agentModalFor) {
      dispatch({ type: 'setAgentModel', agentId: state.agentModalFor, value: model.value });
      dispatch({ type: 'setAgentModalFor', value: null });
    } else {
      dispatch({ type: 'setSelectedModel', value: model.value });
    }
    dispatch({ type: 'setModalOpen', value: false });
  }, [state.agentModalFor]);

  const getManualConfigs = useCallback(() => {
    const keyToUse = (state.selectedApiKey && state.selectedApiKey.trim())
      ? state.selectedApiKey
      : (!cloudEnabled ? "sk_9router" : "<API_KEY_FROM_DASHBOARD>");

    const settingsContent = {
      agents: {
        defaults: {
          model: {
            primary: `9router/${state.selectedModel || "provider/model-id"}`,
          },
        },
      },
      models: {
        providers: {
          "9router": {
            baseUrl: getEffectiveBaseUrl(),
            apiKey: keyToUse,
            api: "openai-completions",
            models: [
              {
                id: state.selectedModel || "provider/model-id",
                name: (state.selectedModel || "provider/model-id").split("/").pop(),
              },
            ],
          },
        },
      },
    };

    return [
      {
        filename: "~/.openclaw/openclaw.json",
        content: JSON.stringify(settingsContent, null, 2),
      },
    ];
  }, [state.selectedApiKey, cloudEnabled, state.selectedModel, getEffectiveBaseUrl]);

  return (
    <Card padding="xs" className="overflow-hidden">
      <OpenClawHeader
        tool={tool}
        isExpanded={isExpanded}
        configStatus={configStatus}
        onToggle={handleToggle}
      />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {state.checkingOpenclaw && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <span>Checking Open Claw CLI...</span>
            </div>
          )}

          {!state.checkingOpenclaw && state.openclawStatus && !state.openclawStatus.installed && (
            <OpenClawNotInstalled onManualConfig={() => dispatch({ type: 'setShowManualConfigModal', value: true })} />
          )}

          {!state.checkingOpenclaw && state.openclawStatus?.installed && (
            <>
              <OpenClawSettingsForm
                state={state}
                dispatch={dispatch}
                apiKeys={apiKeys}
                cloudEnabled={cloudEnabled}
                hasActiveProviders={hasActiveProviders}
                getEffectiveBaseUrl={getEffectiveBaseUrl}
                tunnelEnabled={tunnelEnabled}
                tunnelPublicUrl={tunnelPublicUrl}
                tailscaleEnabled={tailscaleEnabled}
                tailscaleUrl={tailscaleUrl}
                tool={tool}
              />

              <OpenClawStatusMessage message={state.message} />

              <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
                <Button variant="primary" size="sm" onClick={handleApplySettings} disabled={!state.selectedModel} loading={state.applying}>
                  <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetSettings} disabled={!state.openclawStatus?.has9Router} loading={state.restoring}>
                  <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'setShowManualConfigModal', value: true })}>
                  <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ModelSelectModal
        isOpen={state.modalOpen}
        onClose={() => dispatch({ type: 'setModalOpen', value: false })}
        onSelect={handleModelSelect}
        selectedModel={state.selectedModel}
        activeProviders={activeProviders}
        modelAliases={state.modelAliases}
        title="Select Model for Open Claw"
      />

      <ManualConfigModal
        isOpen={state.showManualConfigModal}
        onClose={() => dispatch({ type: 'setShowManualConfigModal', value: false })}
        title="Open Claw - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
