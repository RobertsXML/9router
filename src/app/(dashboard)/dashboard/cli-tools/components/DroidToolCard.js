"use client";

import { useState, useMemo, useReducer } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import { matchKnownEndpoint } from "./cliEndpointMatch";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

// ── Reducers ────────────────────────────────────────────────────────────────

const statusReducer = (state, action) => {
  switch (action.type) {
    case 'setDroidStatus': return { ...state, droidStatus: action.value };
    case 'setCheckingDroid': return { ...state, checkingDroid: action.value };
    case 'setApplying': return { ...state, applying: action.value };
    case 'setRestoring': return { ...state, restoring: action.value };
    case 'setMessage': return { ...state, message: action.value };
    default: return state;
  }
};

const formReducer = (state, action) => {
  switch (action.type) {
    case 'setSelectedApiKey': return { ...state, selectedApiKey: action.value };
    case 'setModelList': return { ...state, modelList: action.value };
    case 'setModelInput': return { ...state, modelInput: action.value };
    case 'setCustomBaseUrl': return { ...state, customBaseUrl: action.value };
    case 'setModalOpen': return { ...state, modalOpen: action.value };
    case 'setShowManualConfigModal': return { ...state, showManualConfigModal: action.value };
    case 'setShowInstallGuide': return { ...state, showInstallGuide: action.value };
    case 'resetForm': return { ...state, message: null, modelList: [] };
    default: return state;
  }
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
          <Image src="/providers/droid.png" alt={tool.name} width={32} height={32} className="size-8 object-contain rounded-lg" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} />
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

function DroidStatusIndicator({ checkingDroid }) {
  if (!checkingDroid) return null;
  return (
    <div className="flex items-center gap-2 text-text-muted">
      <span className="material-symbols-outlined animate-spin">progress_activity</span>
      <span>Checking Factory Droid CLI...</span>
    </div>
  );
}

function DroidInstallGuide({
  droidStatus, checkingDroid, showInstallGuide, setShowInstallGuide, setShowManualConfigModal,
}) {
  if (checkingDroid || !droidStatus || droidStatus.installed) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-yellow-500">warning</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Factory Droid CLI not detected locally</p>
            <p className="text-sm text-text-muted">Manual configuration is still available if 9router is deployed on a remote server.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-9">
          <Button variant="secondary" size="sm" onClick={() => setShowManualConfigModal(true)} className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30">
            <span className="material-symbols-outlined text-[18px] mr-1">content_copy</span>
            Manual Config
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowInstallGuide(!showInstallGuide)}>
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
              <code className="block px-3 py-2 bg-black/5 dark:bg-white/5 rounded font-mono text-xs">curl -fsSL https://app.factory.ai/cli | sh</code>
            </div>
            <p className="text-text-muted">After installation, run <code className="px-1 bg-black/5 dark:bg-white/5 rounded">droid</code> to verify.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DroidConfigFields({
  tool, droidStatus, form, dispatch, hasActiveProviders,
  apiKeys, cloudEnabled, activeProviders, modelAliases,
  tunnelEnabled, tunnelPublicUrl, tailscaleEnabled, tailscaleUrl,
  addModel, removeModel, handleModelSelect, effectiveBaseUrl,
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <BaseUrlSelect
          value={form.customBaseUrl || effectiveBaseUrl}
          onChange={(v) => dispatch({ type: 'setCustomBaseUrl', value: v })}
          requiresExternalUrl={tool.requiresExternalUrl}
          tunnelEnabled={tunnelEnabled}
          tunnelPublicUrl={tunnelPublicUrl}
          tailscaleEnabled={tailscaleEnabled}
          tailscaleUrl={tailscaleUrl}
        />
      </div>

      {droidStatus?.settings?.customModels?.find(m => m.id?.startsWith("custom:9Router"))?.baseUrl && (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
            {droidStatus.settings.customModels.find(m => m.id?.startsWith("custom:9Router")).baseUrl}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <ApiKeySelect value={form.selectedApiKey} onChange={(v) => dispatch({ type: 'setSelectedApiKey', value: v })} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
          Models {form.modelList.length > 0 && <span className="text-primary">({form.modelList.length})</span>}
        </span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        <div className="flex-1 flex flex-col gap-1">
          {form.modelList.length > 0 && (
            <div className="flex flex-col gap-0.5 mb-1">
              {form.modelList.map((id) => (
                <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-bg-secondary rounded border border-border">
                  <span className="flex-1 text-xs font-mono truncate">{id}</span>
                  <button type="button" onClick={() => removeModel(id)} className="text-text-muted hover:text-red-500 transition-colors shrink-0" title="Remove">
                    <span className="material-symbols-outlined text-[12px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={form.modelInput}
              onChange={(e) => dispatch({ type: 'setModelInput', value: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModel(); } }}
              placeholder="provider/model-id"
              aria-label="Add model"
              className="w-full min-w-0 px-2 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: 'setModalOpen', value: true })}
              disabled={!hasActiveProviders}
              className={`px-2 py-1.5 rounded border text-xs shrink-0 ${hasActiveProviders ? "bg-surface border-border hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
            >
              Select
            </button>
            <button type="button" onClick={addModel} disabled={!form.modelInput.trim()} className="px-2 py-1.5 rounded border bg-surface border-border hover:border-primary text-xs shrink-0 disabled:opacity-50" title="Add model">
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DroidActionButtons({ handleApplySettings, handleResetSettings, applying, restoring, modelList, droidStatus, setShowManualConfigModal }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
      <Button variant="primary" size="sm" onClick={handleApplySettings} disabled={modelList.length === 0} loading={applying}>
        <span className="material-symbols-outlined text-[14px] mr-1">save</span>Apply
      </Button>
      <Button variant="outline" size="sm" onClick={handleResetSettings} disabled={!droidStatus?.has9Router} loading={restoring}>
        <span className="material-symbols-outlined text-[14px] mr-1">restore</span>Reset
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
        <span className="material-symbols-outlined text-[14px] mr-1">content_copy</span>Manual Config
      </Button>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DroidToolCard({
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
  const initialModels = (() => {
    if (!initialStatus?.installed) return [];
    const existingModels = (initialStatus.settings?.customModels || [])
      .filter(m => m.id?.startsWith("custom:9Router"))
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map(m => m.model);
    if (existingModels.length > 0) return existingModels;
    const legacy = initialStatus.settings?.customModels?.find(m => m.id === "custom:9Router-0");
    return legacy?.model ? [legacy.model] : [];
  })();

  const [status, statusDispatch] = useReducer(statusReducer, {
    droidStatus: initialStatus || null,
    checkingDroid: false,
    applying: false,
    restoring: false,
    message: null,
  });

  const [form, formDispatch] = useReducer(formReducer, {
    selectedApiKey: apiKeys?.[0]?.key || "",
    modelList: initialModels,
    modelInput: "",
    customBaseUrl: "",
    modalOpen: false,
    showManualConfigModal: false,
    showInstallGuide: false,
  });

  const [modelAliases, setModelAliases] = useState({});

  const { droidStatus, checkingDroid, applying, restoring, message } = status;
  const { selectedApiKey, modelList, modelInput, modalOpen, showManualConfigModal, showInstallGuide, customBaseUrl } = form;

  const configStatus = useMemo(() => {
    if (!droidStatus?.installed) return null;
    const currentConfig = droidStatus.settings?.customModels?.find(m => m.id?.startsWith("custom:9Router"));
    if (!currentConfig) return "not_configured";
    return matchKnownEndpoint(currentConfig.baseUrl, { tunnelPublicUrl, tailscaleUrl, cloudUrl: cloudEnabled ? CLOUD_URL : null }) ? "configured" : "other";
  }, [droidStatus, tunnelPublicUrl, tailscaleUrl, cloudEnabled]);

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  const checkDroidStatus = async () => {
    statusDispatch({ type: 'setCheckingDroid', value: true });
    try {
      const res = await fetch("/api/cli-tools/droid-settings");
      const data = await res.json();
      statusDispatch({ type: 'setDroidStatus', value: data });
    } catch (error) {
      statusDispatch({ type: 'setDroidStatus', value: { installed: false, error: error.message } });
    } finally {
      statusDispatch({ type: 'setCheckingDroid', value: false });
    }
  };

  const handleToggle = () => {
    if (!isExpanded) {
      if (!droidStatus) checkDroidStatus();
      fetchModelAliases();
    }
    onToggle();
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || baseUrl;
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const addModel = () => {
    const val = modelInput.trim();
    if (!val || modelList.includes(val)) return;
    formDispatch({ type: 'setModelList', value: [...modelList, val] });
    formDispatch({ type: 'setModelInput', value: "" });
  };

  const removeModel = (id) => formDispatch({ type: 'setModelList', value: modelList.filter((m) => m !== id) });

  const handleModelSelect = (model) => {
    if (!model.value || modelList.includes(model.value)) return;
    formDispatch({ type: 'setModelList', value: [...modelList, model.value] });
    formDispatch({ type: 'setModalOpen', value: false });
  };

  const handleApplySettings = async () => {
    statusDispatch({ type: 'setApplying', value: true });
    statusDispatch({ type: 'setMessage', value: null });
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch("/api/cli-tools/droid-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          models: modelList,
          activeModel: modelList[0] || "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        statusDispatch({ type: 'setMessage', value: { type: "success", text: "Settings applied successfully!" } });
        checkDroidStatus();
      } else {
        statusDispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to apply settings" } });
      }
    } catch (error) {
      statusDispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      statusDispatch({ type: 'setApplying', value: false });
    }
  };

  const handleResetSettings = async () => {
    statusDispatch({ type: 'setRestoring', value: true });
    statusDispatch({ type: 'setMessage', value: null });
    try {
      const res = await fetch("/api/cli-tools/droid-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        statusDispatch({ type: 'setMessage', value: { type: "success", text: "Settings reset successfully!" } });
        formDispatch({ type: 'resetForm' });
        checkDroidStatus();
      } else {
        statusDispatch({ type: 'setMessage', value: { type: "error", text: data.error || "Failed to reset settings" } });
      }
    } catch (error) {
      statusDispatch({ type: 'setMessage', value: { type: "error", text: error.message } });
    } finally {
      statusDispatch({ type: 'setRestoring', value: false });
    }
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

    const settingsContent = {
      customModels: modelList.map((m, i) => ({
        model: m,
        id: `custom:9Router-${i}`,
        index: i,
        baseUrl: getEffectiveBaseUrl(),
        apiKey: keyToUse,
        displayName: m,
        maxOutputTokens: 131072,
        noImageSupport: false,
        provider: "openai",
      })),
    };

    const platform = typeof navigator !== "undefined" && navigator.platform;
    const isWindows = platform?.toLowerCase().includes("win");
    const settingsPath = isWindows
      ? "%USERPROFILE%\\.factory\\settings.json"
      : "~/.factory/settings.json";

    return [
      {
        filename: settingsPath,
        content: JSON.stringify(settingsContent, null, 2),
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <ToolHeader tool={tool} configStatus={configStatus} isExpanded={isExpanded} handleToggle={handleToggle} handleToggleKeyDown={handleToggleKeyDown} />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          <DroidStatusIndicator checkingDroid={checkingDroid} />

          <DroidInstallGuide
            droidStatus={droidStatus}
            checkingDroid={checkingDroid}
            showInstallGuide={showInstallGuide}
            setShowInstallGuide={(v) => formDispatch({ type: 'setShowInstallGuide', value: v })}
            setShowManualConfigModal={(v) => formDispatch({ type: 'setShowManualConfigModal', value: v })}
          />

          {!checkingDroid && droidStatus?.installed && (
            <>
              <DroidConfigFields
                tool={tool}
                droidStatus={droidStatus}
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
                addModel={addModel}
                removeModel={removeModel}
                handleModelSelect={handleModelSelect}
                effectiveBaseUrl={getEffectiveBaseUrl()}
              />
              {message && (
                <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                  <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
                  <span>{message.text}</span>
                </div>
              )}
              <DroidActionButtons
                handleApplySettings={handleApplySettings}
                handleResetSettings={handleResetSettings}
                applying={applying}
                restoring={restoring}
                modelList={modelList}
                droidStatus={droidStatus}
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
        selectedModel={null}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title="Select Model for Factory Droid"
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => formDispatch({ type: 'setShowManualConfigModal', value: false })}
        title="Factory Droid - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
