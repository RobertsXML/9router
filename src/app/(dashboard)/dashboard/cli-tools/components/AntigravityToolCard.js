"use client";

import { useReducer, useCallback } from "react";
import { Card, Button, Badge, Modal, Input, ModelSelectModal } from "@/shared/components";
import Image from "next/image";

const initialState = {
  status: null,
  loading: false,
  startingStep: null,
  showPasswordModal: false,
  sudoPassword: "",
  selectedApiKey: "",
  message: null,
  modelMappings: {},
  modalOpen: false,
  currentEditingAlias: null,
  modelAliases: {},
};

const reducer = (state, action) => {
  switch (action.type) {
    case "setStatus": return { ...state, status: action.value };
    case "setLoading": return { ...state, loading: action.value };
    case "setStartingStep": return { ...state, startingStep: action.value };
    case "setShowPasswordModal": return { ...state, showPasswordModal: action.value };
    case "setSudoPassword": return { ...state, sudoPassword: action.value };
    case "setSelectedApiKey": return { ...state, selectedApiKey: action.value };
    case "setMessage": return { ...state, message: action.value };
    case "setModelMappings": return { ...state, modelMappings: action.value };
    case "updateModelMapping": return { ...state, modelMappings: { ...state.modelMappings, [action.alias]: action.value } };
    case "setModalOpen": return { ...state, modalOpen: action.value };
    case "setCurrentEditingAlias": return { ...state, currentEditingAlias: action.value };
    case "setModelAliases": return { ...state, modelAliases: action.value };
    case "resetPasswordModal": return { ...state, showPasswordModal: false, sudoPassword: "", message: null };
    default: return state;
  }
};

function AntigravityToolHeader({ tool, isRunning, isExpanded, onToggle }) {
  return (
    <button type="button" className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image
            src="/providers/antigravity.png"
            alt={tool.name}
            width={32}
            height={32}
            className="size-8 object-contain rounded-lg"
            sizes="32px"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm">{tool.name}</h3>
            {isRunning ? (
              <Badge variant="success" size="sm">Active</Badge>
            ) : (
              <Badge variant="default" size="sm">Inactive</Badge>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">{tool.description}</p>
        </div>
      </div>
      <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>expand_more</span>
    </button>
  );
}

function MitmStatusIndicators({ status, startingStep }) {
  return (
    <div className="flex items-center gap-1">
      {[
        { key: "cert", label: "Cert", ok: status?.certExists },
        { key: "server", label: "Server", ok: status?.running },
        { key: "dns", label: "DNS", ok: status?.dnsConfigured },
      ].map(({ key, label, ok }, i) => {
        const isLoading = startingStep === key;
        return (
          <div key={key} className="flex items-center">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md">
              {isLoading ? (
                <span className="material-symbols-outlined text-[14px] text-primary animate-spin">progress_activity</span>
              ) : (
                <span className={`material-symbols-outlined text-[14px] ${ok ? "text-green-500" : "text-text-muted"}`}>
                  {ok ? "check_circle" : "radio_button_unchecked"}
                </span>
              )}
              <span className={`text-xs font-medium ${isLoading ? "text-primary" : ok ? "text-green-500" : "text-text-muted"}`}>
                {label}
              </span>
            </div>
            {i < 2 && <span className="material-symbols-outlined text-[12px] text-text-muted">arrow_forward</span>}
          </div>
        );
      })}
    </div>
  );
}

function PasswordModalContent({ isOpen, sudoPassword, message, loading, dispatch, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch({ type: "resetPasswordModal" })}
      title="Sudo Password Required"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="material-symbols-outlined text-yellow-500 text-[20px]">warning</span>
          <p className="text-xs text-text-muted">Required for SSL certificate and DNS configuration</p>
        </div>

        <Input
          type="password"
          placeholder="Enter sudo password"
          value={sudoPassword}
          onChange={(e) => dispatch({ type: "setSudoPassword", value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) onConfirm();
          }}
        />

        {message && (
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
            <span className="material-symbols-outlined text-[14px]">{message.type === "success" ? "check_circle" : "error"}</span>
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch({ type: "resetPasswordModal" })}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModelMappingSection({ apiKeys, effectiveApiKey, cloudEnabled, tool, modelMappings, hasActiveProviders, loading, dispatch, openModelSelector, onSaveMappings }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
        <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
        <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
        {apiKeys.length > 0 ? (
          <select
            value={effectiveApiKey}
            onChange={(e) => dispatch({ type: "setSelectedApiKey", value: e.target.value })}
            aria-label="Select API key"
            className="w-full min-w-0 px-2 py-2 bg-surface rounded text-xs border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
          >
            {apiKeys.map((key) => <option key={key.id} value={key.key}>{key.key}</option>)}
          </select>
        ) : (
          <span className="min-w-0 rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
            {cloudEnabled ? "No API keys - Create one in Keys page" : "sk_9router (default)"}
          </span>
        )}
      </div>

      {tool.defaultModels.map((model) => (
        <div key={model.alias} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">{model.name}</span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
          <div className="relative w-full min-w-0">
            <input
              type="text"
              value={modelMappings[model.alias] || ""}
              onChange={(e) => dispatch({ type: "updateModelMapping", alias: model.alias, value: e.target.value })}
              placeholder="provider/model-id"
              aria-label={model.name}
              className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5"
            />
            {modelMappings[model.alias] && (
              <button
                type="button"
                onClick={() => dispatch({ type: "updateModelMapping", alias: model.alias, value: "" })}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-red-500 rounded transition-colors"
                title="Clear"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => openModelSelector(model.alias)}
            disabled={!hasActiveProviders}
            className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
          >
            Select
          </button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
        <Button
          variant="primary"
          size="sm"
          onClick={onSaveMappings}
          disabled={loading || Object.keys(modelMappings).length === 0}
        >
          <span className="material-symbols-outlined text-[14px] mr-1">save</span>
          Save Mappings
        </Button>
      </div>
    </>
  );
}

export default function AntigravityToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  activeProviders,
  hasActiveProviders,
  cloudEnabled,
  initialStatus,
}) {
  const [{ status, loading, startingStep, showPasswordModal, sudoPassword, selectedApiKey, message, modelMappings, modalOpen, currentEditingAlias, modelAliases }, dispatch] =
    useReducer(reducer, initialStatus, (s) => ({ ...initialState, status: s || null }));

  const effectiveApiKey = selectedApiKey || apiKeys?.[0]?.key || "";

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      if (!status) {
        fetch("/api/cli-tools/antigravity-mitm")
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data) dispatch({ type: "setStatus", value: data }); })
          .catch(() => dispatch({ type: "setStatus", value: { running: false } }));
      }
      fetch("/api/cli-tools/antigravity-mitm/alias?tool=antigravity")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const aliases = data?.aliases || {};
          if (Object.keys(aliases).length > 0) dispatch({ type: "setModelMappings", value: aliases });
        })
        .catch(() => {});
      fetch("/api/models/alias")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) dispatch({ type: "setModelAliases", value: data.aliases || {} }); })
        .catch(() => {});
    }
    onToggle();
  }, [isExpanded, onToggle, status]);

  // MITM elevation is decided by the server OS, not by this browser's OS.
  const serverIsWindows = status?.isWin === true;
  const canRunWithoutPassword = serverIsWindows || status?.hasCachedPassword || status?.needsSudoPassword === false;

  const handleStart = () => {
    if (canRunWithoutPassword) {
      doStart("");
    } else {
      dispatch({ type: "setShowPasswordModal", value: true });
      dispatch({ type: "setMessage", value: null });
    }
  };

  const handleStop = () => {
    if (canRunWithoutPassword) {
      doStop("");
    } else {
      dispatch({ type: "setShowPasswordModal", value: true });
      dispatch({ type: "setMessage", value: null });
    }
  };

  const doStart = async (password) => {
    dispatch({ type: "setLoading", value: true });
    dispatch({ type: "setMessage", value: null });
    // Show steps progressing in order
    dispatch({ type: "setStartingStep", value: "cert" });
    try {
      const keyToUse = effectiveApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch("/api/cli-tools/antigravity-mitm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToUse, sudoPassword: password }),
      });

      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setStartingStep", value: null });
        dispatch({ type: "setMessage", value: { type: "success", text: "MITM started" } });
        dispatch({ type: "setShowPasswordModal", value: false });
        dispatch({ type: "setSudoPassword", value: "" });
        fetchStatus();
      } else {
        dispatch({ type: "setStartingStep", value: null });
        dispatch({ type: "setMessage", value: { type: "error", text: data.error || "Failed to start" } });
      }
    } catch (error) {
      dispatch({ type: "setStartingStep", value: null });
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setLoading", value: false });
    }
  };

  const doStop = async (password) => {
    dispatch({ type: "setLoading", value: true });
    dispatch({ type: "setMessage", value: null });
    try {
      const res = await fetch("/api/cli-tools/antigravity-mitm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudoPassword: password }),
      });

      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "setMessage", value: { type: "success", text: "MITM stopped" } });
        dispatch({ type: "setShowPasswordModal", value: false });
        dispatch({ type: "setSudoPassword", value: "" });
        fetchStatus();
      } else {
        dispatch({ type: "setMessage", value: { type: "error", text: data.error || "Failed to stop" } });
      }
    } catch (error) {
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setLoading", value: false });
    }
  };

  const handleConfirmPassword = () => {
    if (!sudoPassword.trim()) {
      dispatch({ type: "setMessage", value: { type: "error", text: "Sudo password is required" } });
      return;
    }
    if (status?.running) {
      doStop(sudoPassword);
    } else {
      doStart(sudoPassword);
    }
  };

  const openModelSelector = (alias) => {
    dispatch({ type: "setCurrentEditingAlias", value: alias });
    dispatch({ type: "setModalOpen", value: true });
  };

  const handleModelSelect = (model) => {
    if (currentEditingAlias) {
      dispatch({ type: "updateModelMapping", alias: currentEditingAlias, value: model.value });
    }
  };

  const handleSaveMappings = async () => {
    dispatch({ type: "setLoading", value: true });
    dispatch({ type: "setMessage", value: null });

    try {
      const res = await fetch("/api/cli-tools/antigravity-mitm/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "antigravity", mappings: modelMappings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mappings");
      }

      dispatch({ type: "setMessage", value: { type: "success", text: "Mappings saved!" } });
    } catch (error) {
      dispatch({ type: "setMessage", value: { type: "error", text: error.message } });
    } finally {
      dispatch({ type: "setLoading", value: false });
    }
  };

  const isRunning = status?.running;

  return (
    <Card padding="xs" className="overflow-hidden">
      <AntigravityToolHeader tool={tool} isRunning={isRunning} isExpanded={isExpanded} onToggle={handleToggle} />

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {/* Status indicators — ordered: Cert → Server → DNS */}
          <MitmStatusIndicators status={status} startingStep={startingStep} />

          {/* Start/Stop Button */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 font-medium text-sm flex items-center gap-2 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                Stop MITM
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={loading || !hasActiveProviders}
                className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary font-medium text-sm flex items-center gap-2 hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
                Start MITM
              </button>
            )}
          </div>

          {message?.type === "error" && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-600">
              <span className="material-symbols-outlined text-[14px]">error</span>
              <span>{message.text}</span>
            </div>
          )}

          {/* When running: API Key + Model Mappings */}
          {isRunning && (
            <ModelMappingSection
              apiKeys={apiKeys}
              effectiveApiKey={effectiveApiKey}
              cloudEnabled={cloudEnabled}
              tool={tool}
              modelMappings={modelMappings}
              hasActiveProviders={hasActiveProviders}
              loading={loading}
              dispatch={dispatch}
              openModelSelector={openModelSelector}
              onSaveMappings={handleSaveMappings}
            />
          )}

          {/* Windows admin warning */}
          {!isRunning && serverIsWindows && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              <span>Windows: Run terminal (9Router) as Administrator to enable MITM</span>
            </div>
          )}

          {/* When stopped: how it works */}
          {!isRunning && (
            <div className="flex flex-col gap-1.5 px-1">
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text-main">How it works:</span> Intercepts Antigravity traffic via DNS redirect, letting you reroute models through 9Router.
              </p>
              <div className="flex flex-col gap-0.5 text-[11px] text-text-muted">
                <span>1. Generates SSL cert & adds to system keychain</span>
                <span>2. Redirects <code className="text-[10px] bg-surface px-1 rounded">daily-cloudcode-pa.googleapis.com</code> → localhost</span>
                <span>3. Maps Antigravity models to any provider via 9Router</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Password Modal */}
      <PasswordModalContent
        isOpen={showPasswordModal}
        sudoPassword={sudoPassword}
        message={message}
        loading={loading}
        dispatch={dispatch}
        onConfirm={handleConfirmPassword}
      />

      {/* Model Select Modal */}
      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => dispatch({ type: "setModalOpen", value: false })}
        onSelect={handleModelSelect}
        selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={`Select model for ${currentEditingAlias}`}
      />
    </Card>
  );
}
