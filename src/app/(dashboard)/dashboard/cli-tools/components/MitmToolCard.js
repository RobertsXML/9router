"use client";

import { useReducer, useCallback } from "react";
import { Card, Button, Badge, Input, ModelSelectModal } from "@/shared/components";
import { TOOL_HOSTS } from "@/shared/constants/mitmToolHosts";
import Image from "next/image";

const EMPTY_OBJECT = {};

const initialState = {
  loading: false,
  warning: null,
  showPasswordModal: false,
  sudoPassword: "",
  pendingDnsAction: null,
  modalError: null,
  modelMappings: {},
  modalOpen: false,
  currentEditingAlias: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'setLoading': return { ...state, loading: action.value };
    case 'setWarning': return { ...state, warning: action.value };
    case 'setShowPasswordModal': return { ...state, showPasswordModal: action.value };
    case 'setSudoPassword': return { ...state, sudoPassword: action.value };
    case 'setPendingDnsAction': return { ...state, pendingDnsAction: action.value };
    case 'setModalError': return { ...state, modalError: action.value };
    case 'setModelMappings': return { ...state, modelMappings: action.value };
    case 'setModelMapping': return { ...state, modelMappings: { ...state.modelMappings, [action.alias]: action.value } };
    case 'setModalOpen': return { ...state, modalOpen: action.value };
    case 'setCurrentEditingAlias': return { ...state, currentEditingAlias: action.value };
    case 'reset': return initialState;
    default: return state;
  }
};

function MitmToolHeader({ tool, isExpanded, serverRunning, dnsActive, onToggle }) {
  return (
    <button type="button" className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-8 flex items-center justify-center shrink-0">
          <Image
            src={tool.image}
            alt={tool.name}
            width={32}
            height={32}
            className="size-8 object-contain rounded-lg"
            sizes="32px"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm">{tool.name}</h3>
            {!serverRunning ? (
              <Badge variant="default" size="sm">Server off</Badge>
            ) : dnsActive ? (
              <Badge variant="success" size="sm">Active</Badge>
            ) : (
              <Badge variant="warning" size="sm">DNS off</Badge>
            )}
          </div>
          <p className="text-xs text-text-muted sm:truncate">Intercept {tool.name} requests via MITM proxy</p>
        </div>
      </div>
      <span className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
        expand_more
      </span>
    </button>
  );
}

function MitmToolPasswordModal({ sudoPassword, modalError, loading, dispatch, onConfirm }) {
  const closeModal = () => {
    dispatch({ type: 'setShowPasswordModal', value: false });
    dispatch({ type: 'setSudoPassword', value: "" });
    dispatch({ type: 'setModalError', value: null });
  };

  return (
    <dialog open aria-label="Sudo Password Required" onClose={closeModal} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" style={{ border: 'none', padding: 0, maxWidth: 'none', maxHeight: 'none', width: '100%', height: '100%' }}>
      <div className="flex h-full w-full items-center justify-center" onClick={closeModal} onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }} role="presentation">
      <div className="mx-4 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-text-main">Sudo Password Required</h3>
        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="material-symbols-outlined text-yellow-500 text-[20px]">warning</span>
          <p className="text-xs text-text-muted">Required to modify /etc/hosts and flush DNS cache</p>
        </div>
        <Input
          type="password"
          placeholder="Enter sudo password"
          value={sudoPassword}
          onChange={(e) => dispatch({ type: 'setSudoPassword', value: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) onConfirm(); }}
        />
        {modalError && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-600">
            <span className="material-symbols-outlined text-[14px]">error</span>
            <span>{modalError}</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={closeModal} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} loading={loading}>
            Confirm
          </Button>
        </div>
      </div>
      </div>
    </dialog>
  );
}

/**
 * Per-tool MITM card — shows DNS status + model mappings.
 * - Auto-saves model mapping on blur or modal select
 * - Skips sudo modal if password is already cached
 * - Model mappings can only be edited when DNS is active
 */
export default function MitmToolCard({
  tool,
  isExpanded,
  onToggle,
  serverRunning,
  dnsActive,
  hasCachedPassword,
  needsSudoPassword,
  isWin,
  apiKeys,
  activeProviders,
  hasActiveProviders,
  modelAliases = EMPTY_OBJECT,
  cloudEnabled,
  onDnsChange,
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const mitmHosts = TOOL_HOSTS[tool.id] ?? [];
  const canRunWithoutPassword = isWin || hasCachedPassword || needsSudoPassword === false;

  const loadSavedMappings = useCallback(async () => {
    try {
      const res = await fetch(`/api/cli-tools/antigravity-mitm/alias?tool=${tool.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Object.keys(data.aliases || {}).length > 0) dispatch({ type: 'setModelMappings', value: data.aliases });
      }
    } catch { /* ignore */ }
  }, [tool.id]);

  const handleToggle = useCallback(() => {
    if (!isExpanded) loadSavedMappings();
    onToggle();
  }, [isExpanded, onToggle, loadSavedMappings]);

  const saveMappings = useCallback(async (mappings) => {
    try {
      await fetch("/api/cli-tools/antigravity-mitm/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.id, mappings }),
      });
    } catch { /* ignore */ }
  }, [tool.id]);

  const handleMappingBlur = (alias, value) => {
    saveMappings({ ...state.modelMappings, [alias]: value });
  };

  const handleModelMappingChange = (alias, value) => {
    dispatch({ type: 'setModelMapping', alias, value });
  };

  const openModelSelector = (alias) => {
    dispatch({ type: 'setCurrentEditingAlias', value: alias });
    dispatch({ type: 'setModalOpen', value: true });
  };

  const handleModelSelect = (model) => {
    if (!state.currentEditingAlias || model.isPlaceholder) return;
    const updated = { ...state.modelMappings, [state.currentEditingAlias]: model.value };
    dispatch({ type: 'setModelMappings', value: updated });
    saveMappings(updated);
  };

  const handleDnsToggle = () => {
    if (!serverRunning) return;
    const action = dnsActive ? "disable" : "enable";
    if (canRunWithoutPassword) {
      doDnsAction(action, "");
    } else {
      dispatch({ type: 'setPendingDnsAction', value: action });
      dispatch({ type: 'setShowPasswordModal', value: true });
      dispatch({ type: 'setModalError', value: null });
    }
  };

  const doDnsAction = async (action, password) => {
    dispatch({ type: 'setLoading', value: true });
    dispatch({ type: 'setWarning', value: null });
    try {
      const res = await fetch("/api/cli-tools/antigravity-mitm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.id, action, sudoPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle DNS");

      if (action === "enable") {
        dispatch({ type: 'setWarning', value: `Restart ${tool.name} to apply changes` });
      }

      dispatch({ type: 'setShowPasswordModal', value: false });
      dispatch({ type: 'setSudoPassword', value: "" });
      onDnsChange?.(data);
    } catch { /* ignore */ } finally {
      dispatch({ type: 'setLoading', value: false });
      dispatch({ type: 'setPendingDnsAction', value: null });
    }
  };

  const handleConfirmPassword = () => {
    if (!state.sudoPassword.trim()) {
      dispatch({ type: 'setModalError', value: "Sudo password is required" });
      return;
    }
    doDnsAction(state.pendingDnsAction, state.sudoPassword);
  };

  return (
    <>
      <Card padding="xs" className="overflow-hidden">
        <MitmToolHeader
          tool={tool}
          isExpanded={isExpanded}
          serverRunning={serverRunning}
          dnsActive={dnsActive}
          onToggle={handleToggle}
        />

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
            {/* Hosts */}
            {mitmHosts.length > 0 && (
              <div className="mt-2 rounded-md border border-border bg-surface/50 px-2 py-1.5">
                <p className="text-[10px] font-medium tracking-wide text-text-main/80 mb-1">
                  Edit hosts file manually to add the following entries:
                </p>
                <ul className="list-none space-y-0.5 font-mono text-[10px] text-text-muted break-all">
                  {mitmHosts.map((h) => (
                    <li key={h}>127.0.0.1 {h}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Info */}
            <div className="flex flex-col gap-0.5 text-[11px] text-text-muted px-1">
              <p>Toggle DNS to redirect {tool.name} traffic through 9Router via MITM.</p>
              {!dnsActive && (
                <p className="text-amber-600 text-[10px] mt-1">
                  ⚠️ Enable DNS to edit model mappings
                </p>
              )}
            </div>

            {/* Model Mappings */}
            {tool.defaultModels?.length > 0 && (
              <div className="flex flex-col gap-2">
                {tool.defaultModels.map((model) => (
                  <div key={model.alias} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[9rem_auto_1fr_auto] sm:items-center sm:gap-2">
                    <span className="text-xs font-semibold text-text-main sm:text-right">{model.name}</span>
                    <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                    <div className="relative w-full min-w-0">
                      <input
                        type="text"
                        value={state.modelMappings[model.alias] || ""}
                        onChange={(e) => handleModelMappingChange(model.alias, e.target.value)}
                        onBlur={(e) => handleMappingBlur(model.alias, e.target.value)}
                        placeholder="provider/model-id"
                        disabled={!dnsActive}
                        aria-label={`Model mapping for ${model.name}`}
                        className={`w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5 ${!dnsActive ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                      {state.modelMappings[model.alias] && (
                        <button
                          type="button"
                          onClick={() => {
                            handleModelMappingChange(model.alias, "");
                            saveMappings({ ...state.modelMappings, [model.alias]: "" });
                          }}
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
                      disabled={!hasActiveProviders || !dnsActive}
                      className={`rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 ${hasActiveProviders && dnsActive ? "bg-surface border-border hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tool.defaultModels?.length === 0 && (
              <p className="text-xs text-text-muted px-1">Model mappings will be available soon.</p>
            )}

            {/* Start / Stop DNS button */}
            <div className="flex flex-col gap-2 sm:items-start">
              {dnsActive ? (
                <button
                  type="button"
                  onClick={handleDnsToggle}
                  disabled={!serverRunning || state.loading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                  Stop DNS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDnsToggle}
                  disabled={!serverRunning || state.loading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">play_circle</span>
                  Start DNS
                </button>
              )}

              {/* Warning below button */}
              {state.warning && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-amber-500">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  <span>{state.warning}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Password Modal */}
      {state.showPasswordModal && (
        <MitmToolPasswordModal
          sudoPassword={state.sudoPassword}
          modalError={state.modalError}
          loading={state.loading}
          dispatch={dispatch}
          onConfirm={handleConfirmPassword}
        />
      )}

      {/* Model Select Modal */}
      <ModelSelectModal
        isOpen={state.modalOpen}
        onClose={() => dispatch({ type: 'setModalOpen', value: false })}
        onSelect={handleModelSelect}
        selectedModel={state.currentEditingAlias ? state.modelMappings[state.currentEditingAlias] : null}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={`Select model for ${state.currentEditingAlias}`}
      />
    </>
  );
}
