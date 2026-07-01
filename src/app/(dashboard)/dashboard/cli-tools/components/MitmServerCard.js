"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import { Card, Button, Badge, Input } from "@/shared/components";

const DEFAULT_MITM_ROUTER_BASE = "http://localhost:20128";

const init = (initialApiKeys) => ({
  loading: false,
  showPasswordModal: false,
  sudoPassword: "",
  selectedApiKey: initialApiKeys?.[0]?.key || "",
  pendingAction: null,
  modalError: null,
  actionError: null,
  mitmRouterBaseUrl: DEFAULT_MITM_ROUTER_BASE,
  port443Conflict: null,
});

const reducer = (state, action) => {
  switch (action.type) {
    case 'setLoading': return { ...state, loading: action.value };
    case 'setShowPasswordModal': return { ...state, showPasswordModal: action.value };
    case 'setSudoPassword': return { ...state, sudoPassword: action.value };
    case 'setSelectedApiKey': return { ...state, selectedApiKey: action.value };
    case 'setPendingAction': return { ...state, pendingAction: action.value };
    case 'setModalError': return { ...state, modalError: action.value };
    case 'setActionError': return { ...state, actionError: action.value };
    case 'setMitmRouterBaseUrl': return { ...state, mitmRouterBaseUrl: action.value };
    case 'setPort443Conflict': return { ...state, port443Conflict: action.value };
    case 'reset': return init(null);
    default: return state;
  }
};

function MitmPasswordModal({ sudoPassword, modalError, loading, dispatch, onConfirm }) {
  const closeModal = useCallback(() => {
    dispatch({ type: 'setShowPasswordModal', value: false });
    dispatch({ type: 'setSudoPassword', value: "" });
    dispatch({ type: 'setModalError', value: null });
  }, [dispatch]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  return (
    <dialog open aria-label="Sudo Password Required" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ border: 'none', padding: 0, maxWidth: 'none', maxHeight: 'none', width: '100%', height: '100%' }}>
      <button type="button" tabIndex={-1} aria-label="Close dialog" onClick={closeModal} className="absolute inset-0 cursor-default border-none bg-transparent p-0" />
      <div className="relative z-10 mx-4 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6">
        <h3 className="font-semibold text-text-main">Sudo Password Required</h3>
        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="material-symbols-outlined text-yellow-500 text-[20px]">warning</span>
          <p className="text-xs text-text-muted">Required for SSL certificate and server startup</p>
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
    </dialog>
  );
}

function MitmPort443Modal({ port443Conflict, loading, dispatch, onKillAndStart }) {
  const closeModal = useCallback(() => {
    dispatch({ type: 'setPort443Conflict', value: null });
    dispatch({ type: 'setLoading', value: false });
  }, [dispatch]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeModal]);

  return (
    <dialog open aria-label="Port 443 Already In Use" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ border: 'none', padding: 0, maxWidth: 'none', maxHeight: 'none', width: '100%', height: '100%' }}>
      <button type="button" tabIndex={-1} aria-label="Close dialog" onClick={closeModal} className="absolute inset-0 cursor-default border-none bg-transparent p-0" />
      <div className="relative z-10 mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xl sm:p-6">
        <h3 className="font-semibold text-text-main">Port 443 Already In Use</h3>
        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="material-symbols-outlined text-yellow-500 text-[20px]">warning</span>
          <div className="flex flex-col gap-1 text-xs text-text-muted">
            <p>Port 443 is currently used by another process:</p>
            <p className="font-mono text-text-main" data-i18n-skip="true">
              {port443Conflict.owner.name} (PID {port443Conflict.owner.pid})
            </p>
            <p>Kill this process to start MITM Server?</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={closeModal} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onKillAndStart} loading={loading}>
            Kill & Start
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Shared MITM infrastructure card — manages SSL cert + server start/stop.
 * DNS per-tool is handled separately in MitmToolCard.
 */
export default function MitmServerCard({ apiKeys, cloudEnabled, status, onRefresh }) {
  const [state, dispatch] = useReducer(reducer, apiKeys, init);

  const serverIsWindows = status?.isWin === true;
  const canRunWithoutPassword = serverIsWindows || status?.hasCachedPassword || status?.needsSudoPassword === false;
  const isAdmin = status?.isAdmin !== false;
  // No privilege: not admin/root AND (Win OR no cached sudo password)
  const noPrivilege = !isAdmin && (serverIsWindows || (!status?.hasCachedPassword && status?.needsSudoPassword !== false));

  const prevBaseUrlRef = useRef(status?.mitmRouterBaseUrl);
  if (status?.mitmRouterBaseUrl && status.mitmRouterBaseUrl !== prevBaseUrlRef.current) {
    prevBaseUrlRef.current = status.mitmRouterBaseUrl;
    dispatch({ type: 'setMitmRouterBaseUrl', value: status.mitmRouterBaseUrl });
  }

  const handleAction = (action) => {
    dispatch({ type: 'setActionError', value: null });
    // Wait for status to load before deciding whether to show sudo modal
    if (!status) return;
    if (canRunWithoutPassword) {
      doAction(action, "");
    } else {
      dispatch({ type: 'setPendingAction', value: action });
      dispatch({ type: 'setShowPasswordModal', value: true });
      dispatch({ type: 'setModalError', value: null });
    }
  };

  const doAction = async (action, password, forceKillPort443 = false) => {
    dispatch({ type: 'setLoading', value: true });
    dispatch({ type: 'setActionError', value: null });
    try {
      let res;
      if (action === "trust-cert") {
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trust-cert", sudoPassword: password }),
        });
      } else if (action === "start") {
        const keyToUse = state.selectedApiKey?.trim()
          || (apiKeys?.length > 0 ? apiKeys[0].key : null)
          || (!cloudEnabled ? "sk_9router" : null);
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: keyToUse,
            sudoPassword: password,
            mitmRouterBaseUrl: state.mitmRouterBaseUrl.trim() || DEFAULT_MITM_ROUTER_BASE,
            forceKillPort443,
          }),
        });
      } else {
        res = await fetch("/api/cli-tools/antigravity-mitm", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sudoPassword: password }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "PORT_443_BUSY" && data.portOwner) {
          dispatch({ type: 'setShowPasswordModal', value: false });
          dispatch({ type: 'setPort443Conflict', value: { owner: data.portOwner, password } });
          return;
        }
        dispatch({ type: 'setActionError', value: data.error || `Failed to ${action} MITM server` });
        return;
      }
      dispatch({ type: 'setShowPasswordModal', value: false });
      dispatch({ type: 'setSudoPassword', value: "" });
      dispatch({ type: 'setPort443Conflict', value: null });
      await onRefresh();
    } catch (e) {
      dispatch({ type: 'setActionError', value: e.message || "Network error" });
    } finally {
      dispatch({ type: 'setLoading', value: false });
      dispatch({ type: 'setPendingAction', value: null });
    }
  };

  const handleKillAndStart = () => {
    const pwd = state.port443Conflict?.password || "";
    doAction("start", pwd, true);
  };

  const handleConfirmPassword = () => {
    if (!state.sudoPassword.trim()) {
      dispatch({ type: 'setModalError', value: "Sudo password is required" });
      return;
    }
    doAction(state.pendingAction, state.sudoPassword);
  };

  const isRunning = status?.running;

  return (
    <>
      <Card padding="sm" className="border-primary/20 bg-primary/5">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">security</span>
              <span className="font-semibold text-sm text-text-main">MITM Server</span>
              {isRunning ? (
                <Badge variant="success" size="sm">Running</Badge>
              ) : (
                <Badge variant="default" size="sm">Stopped</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs text-text-muted" data-i18n-skip="true">
              {[
                { label: "Cert", ok: status?.certExists },
                { label: "Trusted", ok: status?.certTrusted },
                { label: "Server", ok: isRunning },
              ].map(({ label, ok }) => (
                <span key={label} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${ok ? "text-green-600" : "text-text-muted"}`}>
                  <span className="material-symbols-outlined text-[12px]">
                    {ok ? "check_circle" : "cancel"}
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Purpose & How it works */}
          <div className="px-2 py-2 rounded-lg bg-surface/50 border border-border/50 flex flex-col gap-2">
            <p className="text-[11px] text-text-muted leading-relaxed">
              <span className="font-medium text-text-main">Purpose:</span> Use Antigravity IDE & GitHub Copilot → with ANY provider/model from 9Router
            </p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              <span className="font-medium text-text-main">How it works:</span> Antigravity/Copilot IDE request → DNS redirect to localhost:443 → MITM proxy intercepts → 9Router → response to Antigravity/Copilot
            </p>
          </div>

          {/* Base URL + API Key — same row pattern as Claude Code / cli-tools */}
          <div className="flex flex-col gap-2">
            <div className="grid gap-1 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
              <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">9Router Base URL</span>
              <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
              <input
                type="text"
                value={state.mitmRouterBaseUrl}
                onChange={(e) => dispatch({ type: 'setMitmRouterBaseUrl', value: e.target.value })}
                placeholder={DEFAULT_MITM_ROUTER_BASE}
                disabled={isRunning}
                aria-label="9Router Base URL"
                className="flex-1 min-w-0 px-2 py-1.5 bg-surface rounded border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>
            {!isRunning && (
              <div className="grid gap-1 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
                <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">arrow_forward</span>
                <input
                  type="text"
                  list="mitm-api-keys"
                  value={state.selectedApiKey}
                  onChange={(e) => dispatch({ type: 'setSelectedApiKey', value: e.target.value })}
                  placeholder={cloudEnabled ? "Enter or pick API key" : "sk_9router (default)"}
                  aria-label="API Key"
                  className="flex-1 min-w-0 px-2 py-1.5 bg-surface rounded border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {apiKeys?.length > 0 && (
                  <datalist id="mitm-api-keys">
                    {apiKeys.map((key) => (
                      <option key={key.id} value={key.key}>{key.name || key.key}</option>
                    ))}
                  </datalist>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" data-i18n-skip="true">
            {status?.certExists && !status?.certTrusted && (
              <button
                type="button"
                onClick={() => handleAction("trust-cert")}
                disabled={state.loading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-medium text-yellow-600 transition-colors hover:bg-yellow-500/20 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">verified_user</span>
                Trust Cert
              </button>
            )}
            {isRunning ? (
              <button
                type="button"
                onClick={() => handleAction("stop")}
                disabled={state.loading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                Stop Server
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAction("start")}
                disabled={state.loading || !status || (serverIsWindows && !isAdmin)}
                title={serverIsWindows && !isAdmin ? "Administrator required" : undefined}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">play_circle</span>
                Start Server
              </button>
            )}
            {isRunning && (
              <p className="text-xs text-text-muted">Enable DNS per tool below to activate interception</p>
            )}
          </div>

          {/* Action error */}
          {state.actionError && (
            <div className="flex items-start gap-2 px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">error</span>
              <span>{state.actionError}</span>
            </div>
          )}

          {/* Windows admin warning */}
          {serverIsWindows && !isAdmin && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-600 border border-red-500/20">
              <span className="material-symbols-outlined text-[14px]">shield_lock</span>
              <span>Administrator required — restart 9Router as Administrator to use MITM</span>
            </div>
          )}
        </div>
      </Card>

      {/* Password Modal */}
      {state.showPasswordModal && (
        <MitmPasswordModal
          sudoPassword={state.sudoPassword}
          modalError={state.modalError}
          loading={state.loading}
          dispatch={dispatch}
          onConfirm={handleConfirmPassword}
        />
      )}

      {/* Port 443 Conflict Modal */}
      {state.port443Conflict && (
        <MitmPort443Modal
          port443Conflict={state.port443Conflict}
          loading={state.loading}
          dispatch={dispatch}
          onKillAndStart={handleKillAndStart}
        />
      )}
    </>
  );
}
