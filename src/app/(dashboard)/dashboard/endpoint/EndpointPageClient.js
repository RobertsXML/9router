"use client";

import { useState, useEffect, useEffectEvent, useRef, useCallback, useReducer } from "react";
import PropTypes from "prop-types";
import { Card, Button, Input, Modal, CardSkeleton, Toggle, ConfirmModal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  TUNNEL_BENEFITS,
  TUNNEL_PING_INTERVAL_MS,
  TUNNEL_PING_MAX_MS,
  STATUS_POLL_FAST_MS,
  REACHABLE_MISS_THRESHOLD,
  CLIENT_PING_FAST_MS,
} from "./endpointConstants";
import { clientPingUrl, clientPingAny } from "./endpointPing";
import EndpointRow from "./components/EndpointRow";
import StatusAlert from "./components/StatusAlert";
import Tooltip from "./components/Tooltip";
import SecurityWarning from "./components/SecurityWarning";

function maskKey(fullKey) {
  if (!fullKey || fullKey.length <= 10) return fullKey || "";
  return fullKey.slice(0, 6) + "•".repeat(fullKey.length - 10) + fullKey.slice(-4);
}

// ── Reducers ──────────────────────────────────────────────────────────────────

const tunnelInit = {
  checking: true,
  enabled: false,
  reachable: false,
  url: "",
  publicUrl: "",
  loading: false,
  progress: "",
  status: null,
  showEnableModal: false,
  showDisableModal: false,
  everReachable: false,
};

function tunnelReducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const tailscaleInit = {
  enabled: false,
  reachable: false,
  url: "",
  loading: false,
  progress: "",
  status: null,
  authUrl: "",
  authLabel: "",
  installed: null,
  installing: false,
  installLog: [],
  sudoPassword: "",
  connecting: false,
  showModal: false,
  showDisableModal: false,
  everReachable: false,
};

function tailscaleReducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const settingsInit = {
  keys: [],
  loading: true,
  showAddModal: false,
  newKeyName: "",
  createdKey: null,
  confirmState: null,
  requireApiKey: false,
  requireLogin: true,
  hasPassword: true,
  tunnelDashboardAccess: false,
  visibleKeys: new Set(),
};

function settingsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TunnelStatusRow({ tunnel, copied, copy, dispatchTunnel, isLoginUnsafe, requireApiKey, unsafeReason }) {
  const { checking, enabled, reachable, url, publicUrl, loading, progress, status, everReachable } = tunnel;
  const displayUrl = `${publicUrl || url}/v1`;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[88px] text-center ${
        enabled ? "bg-primary/10 text-primary" : "bg-surface-2 text-text-muted"
      }`}>Tunnel</span>
      {enabled && !loading && reachable ? (
        <>
          <Input value={displayUrl} readOnly className="flex-1 font-mono text-sm" />
          <button
            type="button"
            onClick={() => copy(displayUrl, "tunnel_url")}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">{copied === "tunnel_url" ? "check" : "content_copy"}</span>
          </button>
          <button
            type="button"
            onClick={() => dispatchTunnel({ type: "SET", payload: { showDisableModal: true } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Disable Tunnel"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : enabled && !loading && !reachable ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-amber-300 dark:border-amber-800 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            {everReachable ? "Tunnel reconnecting..." : "Tunnel checking..."}
          </div>
          <button
            type="button"
            onClick={() => dispatchTunnel({ type: "SET", payload: { showDisableModal: true } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Disable Tunnel"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : loading ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            {progress || "Creating tunnel..."}
          </div>
          <button
            type="button"
            onClick={() => dispatchTunnel({ type: "SET", payload: { loading: false, progress: "" } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Stop"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : status?.type === "error" ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-sm">error</span>
            {status.message}
          </div>
          <Button size="sm" icon="cloud_upload" onClick={() => dispatchTunnel({ type: "SET", payload: { showEnableModal: true } })}>Enable</Button>
        </>
      ) : checking ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            Checking...
          </div>
          <button
            type="button"
            onClick={() => dispatchTunnel({ type: "SET", payload: { checking: false } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Stop"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : (
        <Button
          size="sm"
          icon="cloud_upload"
          onClick={() => {
            if (isLoginUnsafe) {
              dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: `Security required: ${unsafeReason}` } } });
              return;
            }
            if (!requireApiKey) {
              dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: "Security required: Enable \"Require API key\" before activating the tunnel." } } });
              return;
            }
            dispatchTunnel({ type: "SET", payload: { showEnableModal: true } });
          }}
        >
          Enable
        </Button>
      )}
    </div>
  );
}

function TailscaleStatusRow({ ts, copied, copy, dispatchTs, isLoginUnsafe, unsafeReason, onOpenTsModal, onClearUserAuth }) {
  const { enabled, reachable, url, loading, progress, status, authUrl, authLabel, connecting, everReachable } = ts;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 min-w-[88px] text-center ${
        enabled ? "bg-primary/10 text-primary" : "bg-surface-2 text-text-muted"
      }`}>Tailscale</span>
      {enabled && !loading && reachable ? (
        <>
          <Input value={`${url}/v1`} readOnly className="flex-1 font-mono text-sm" />
          <button
            type="button"
            onClick={() => copy(`${url}/v1`, "ts_url")}
            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">{copied === "ts_url" ? "check" : "content_copy"}</span>
          </button>
          <button
            type="button"
            onClick={() => dispatchTs({ type: "SET", payload: { showDisableModal: true } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Disable Tailscale"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : enabled && !loading && !reachable ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-amber-300 dark:border-amber-800 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            {everReachable ? "Tailscale reconnecting..." : "Tailscale checking..."}
          </div>
          <button
            type="button"
            onClick={() => dispatchTs({ type: "SET", payload: { showDisableModal: true } })}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Disable Tailscale"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : (loading || connecting) ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-input text-sm text-text-muted">
            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            {progress || "Connecting..."}
          </div>
          {authUrl && (
            <Button
              size="sm"
              icon="open_in_new"
              onClick={() => window.open(authUrl, "tailscale_auth", "width=600,height=700,noopener,noreferrer")}
            >
              {authLabel || "Open"}
            </Button>
          )}
          <button
            type="button"
            onClick={() => { dispatchTs({ type: "SET", payload: { loading: false, connecting: false, progress: "" } }); onClearUserAuth(); }}
            className="p-2 hover:bg-red-500/10 rounded text-red-500 transition-colors shrink-0"
            title="Stop"
          >
            <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          </button>
        </>
      ) : status?.type === "error" ? (
        <>
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded border border-red-300 dark:border-red-800 bg-red-500/5 text-sm text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-sm">error</span>
            {status.message}
          </div>
          <Button size="sm" icon="vpn_lock" onClick={onOpenTsModal}>Enable</Button>
        </>
      ) : (
        <Button
          size="sm"
          icon="vpn_lock"
          onClick={() => {
            if (isLoginUnsafe) {
              dispatchTs({ type: "SET", payload: { status: { type: "error", message: `Security required: ${unsafeReason}` } } });
              return;
            }
            onOpenTsModal();
          }}
          className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
        >
          Enable
        </Button>
      )}
    </div>
  );
}

function EndpointCard({
  currentEndpoint,
  copied,
  copy,
  tunnel,
  dispatchTunnel,
  ts,
  dispatchTs,
  isLoginUnsafe,
  unsafeReason,
  requireApiKey,
  requireLogin,
  hasPassword,
  tunnelDashboardAccess,
  onTunnelDashboardAccess,
  onOpenTsModal,
  onClearUserAuth,
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">api</span>
        API Endpoint
      </h2>

      <div className="flex flex-col gap-2">
        <EndpointRow
          label="Local"
          url={currentEndpoint}
          copyId="local_url"
          copied={copied}
          onCopy={copy}
        />
        <TunnelStatusRow
          tunnel={tunnel}
          copied={copied}
          copy={copy}
          dispatchTunnel={dispatchTunnel}
          isLoginUnsafe={isLoginUnsafe}
          requireApiKey={requireApiKey}
          unsafeReason={unsafeReason}
        />
        <TailscaleStatusRow
          ts={ts}
          copied={copied}
          copy={copy}
          dispatchTs={dispatchTs}
          isLoginUnsafe={isLoginUnsafe}
          unsafeReason={unsafeReason}
          onOpenTsModal={onOpenTsModal}
          onClearUserAuth={onClearUserAuth}
        />
      </div>

      {isLoginUnsafe && !tunnel.enabled && !ts.enabled && (
        <div className="mt-4">
          <SecurityWarning
            message={unsafeReason}
            action={{ label: "Open settings", href: "/dashboard/profile" }}
          />
        </div>
      )}

      {(tunnel.enabled || ts.enabled) && (
        <div className="mt-4 flex flex-col gap-2">
          {!requireApiKey && (
            <SecurityWarning
              message="Require API key is disabled — your endpoint is publicly accessible without authentication."
              action={{ label: "Enable", href: "#require-api-key" }}
            />
          )}
          {(!requireLogin || !hasPassword) && (
            <SecurityWarning
              message={
                !requireLogin
                  ? "Require login is disabled — anyone can access your dashboard via tunnel."
                  : "Dashboard uses the default password — change it in Profile settings."
              }
              action={{
                label: !requireLogin ? "Enable" : "Change password",
                href: "/dashboard/profile",
              }}
            />
          )}
        </div>
      )}

      {(tunnel.enabled || ts.enabled) && (
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
          <Toggle
            checked={tunnelDashboardAccess}
            onChange={() => onTunnelDashboardAccess(!tunnelDashboardAccess)}
          />
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm">Allow dashboard access via tunnel</p>
            <Tooltip text="When enabled, the dashboard can be accessed through your tunnel or Tailscale URL (login still required). When disabled, dashboard access via tunnel/Tailscale is completely blocked." />
          </div>
        </div>
      )}
    </Card>
  );
}

function ApiKeysCard({
  keys,
  visibleKeys,
  copied,
  copy,
  requireApiKey,
  isRemoteHost,
  onRequireApiKey,
  onShowAddModal,
  onDeleteKey,
  onToggleKey,
  onToggleKeyVisibility,
  setConfirmState,
}) {
  return (
    <Card id="require-api-key">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">vpn_key</span>
          API Keys
        </h2>
        <Button icon="add" onClick={onShowAddModal}>
          Create Key
        </Button>
      </div>

      <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
        <div>
          <p className="font-medium">Require API key</p>
          <p className="text-sm text-text-muted">
            Requests without a valid key will be rejected
          </p>
        </div>
        <Toggle
          checked={requireApiKey}
          onChange={() => onRequireApiKey(!requireApiKey)}
        />
      </div>

      {isRemoteHost && !requireApiKey && (
        <div className="mb-4 -mt-2">
          <SecurityWarning message="Endpoint is exposed without an API key." />
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">vpn_key</span>
          </div>
          <p className="text-text-main font-medium mb-1">No API keys yet</p>
          <p className="text-sm text-text-muted mb-4">Create your first API key to get started</p>
          <Button icon="add" onClick={onShowAddModal}>
            Create Key
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`group flex items-center justify-between py-3 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0 ${key.isActive === false ? "opacity-60" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{key.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs text-text-muted font-mono">
                    {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                  </code>
                  <button
                    type="button"
                    onClick={() => onToggleKeyVisibility(key.id)}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    title={visibleKeys.has(key.id) ? "Hide key" : "Show key"}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {visibleKeys.has(key.id) ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(key.key, key.id)}
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copied === key.id ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                </p>
                {key.isActive === false && (
                  <p className="text-xs text-orange-500 mt-1">Paused</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Toggle
                  size="sm"
                  checked={key.isActive ?? true}
                  onChange={(checked) => {
                    if (key.isActive && !checked) {
                      setConfirmState({
                        title: "Pause API Key",
                        message: `Pause API key "${key.name}"?\n\nThis key will stop working immediately but can be resumed later.`,
                        onConfirm: async () => {
                          setConfirmState(null);
                          onToggleKey(key.id, checked);
                        }
                      });
                    } else {
                      onToggleKey(key.id, checked);
                    }
                  }}
                  title={key.isActive ? "Pause key" : "Resume key"}
                />
                <button
                  type="button"
                  onClick={() => onDeleteKey(key.id)}
                  className="p-2 hover:bg-red-500/10 rounded text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── EndpointModals ────────────────────────────────────────────────────────────

function EndpointModals({
  settings, dispatchSettings, tunnel, dispatchTunnel, ts, dispatchTs,
  copied, copy, handleCreateKey, handleEnableTunnel, handleDisableTunnel,
  handleInstallTailscale, handleConnectTailscale, handleDisableTailscale, tsLogRef,
}) {
  return (
    <>
      <Modal
        isOpen={settings.showAddModal}
        title="Create API Key"
        onClose={() => dispatchSettings({ type: "SET", payload: { showAddModal: false, newKeyName: "" } })}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Key Name"
            value={settings.newKeyName}
            onChange={(e) => dispatchSettings({ type: "SET", payload: { newKeyName: e.target.value } })}
            placeholder="Production Key"
          />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!settings.newKeyName.trim()}>Create</Button>
            <Button onClick={() => dispatchSettings({ type: "SET", payload: { showAddModal: false, newKeyName: "" } })} variant="ghost" fullWidth>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!settings.createdKey}
        title="API Key Created"
        onClose={() => dispatchSettings({ type: "SET", payload: { createdKey: null } })}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">Save this key now!</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">This is the only time you will see this key. Store it securely.</p>
          </div>
          <div className="flex gap-2">
            <Input value={settings.createdKey || ""} readOnly className="flex-1 font-mono text-sm" />
            <Button variant="secondary" icon={copied === "created_key" ? "check" : "content_copy"} onClick={() => copy(settings.createdKey, "created_key")}>
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => dispatchSettings({ type: "SET", payload: { createdKey: null } })} fullWidth>Done</Button>
        </div>
      </Modal>

      <Modal isOpen={tunnel.showEnableModal} title="Enable Tunnel" onClose={() => dispatchTunnel({ type: "SET", payload: { showEnableModal: false } })}>
        <div className="flex flex-col gap-4">
          <div className="bg-surface-2 border border-border-subtle rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary">cloud_upload</span>
              <div>
                <p className="text-sm text-text-main font-medium mb-1">Cloudflare Tunnel</p>
                <p className="text-sm text-text-muted">Expose your local 9Router to the internet. No port forwarding, no static IP needed. Share endpoint URL with your team or use it in Cursor, Cline, and other AI tools from anywhere.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TUNNEL_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex flex-col items-center text-center p-3 rounded-lg bg-sidebar/50">
                <span className="material-symbols-outlined text-xl text-primary mb-1">{benefit.icon}</span>
                <p className="text-xs font-semibold">{benefit.title}</p>
                <p className="text-xs text-text-muted">{benefit.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted">Requires outbound port 7844 (TCP/UDP). Connection may take 10-30s.</p>
          <div className="flex gap-2">
            <Button onClick={handleEnableTunnel} fullWidth>Start Tunnel</Button>
            <Button onClick={() => dispatchTunnel({ type: "SET", payload: { showEnableModal: false } })} variant="ghost" fullWidth>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={tunnel.showDisableModal} title="Disable Tunnel" onClose={() => !tunnel.loading && dispatchTunnel({ type: "SET", payload: { showDisableModal: false } })}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">The Cloudflare tunnel will be disconnected. Remote access via tunnel URL will stop working.</p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTunnel} fullWidth disabled={tunnel.loading} variant="danger">{tunnel.loading ? "Disabling..." : "Disable"}</Button>
            <Button onClick={() => dispatchTunnel({ type: "SET", payload: { showDisableModal: false } })} variant="ghost" fullWidth disabled={tunnel.loading}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={ts.showModal} title="Tailscale Funnel" onClose={() => { if (!ts.installing) dispatchTs({ type: "SET", payload: { showModal: false, sudoPassword: "", status: null } }); }}>
        <div className="flex flex-col gap-4">
          {ts.installed === null && (
            <p className="text-sm text-text-muted flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>Checking...
            </p>
          )}
          {ts.installed === false && !ts.installing && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">Tailscale is not installed. Install it to enable Funnel.</p>
              <div className="flex gap-2">
                <Button onClick={handleInstallTailscale} fullWidth>Install Tailscale</Button>
                <Button onClick={() => dispatchTs({ type: "SET", payload: { showModal: false } })} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}
          {ts.installing && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>Installing Tailscale...
              </div>
              {ts.installLog.length > 0 && (
                <div ref={tsLogRef} className="bg-black/5 dark:bg-white/5 rounded p-2 max-h-40 overflow-y-auto font-mono text-xs text-text-muted">
                  {ts.installLog.map((line) => (<div key={line}>{line}</div>))}
                </div>
              )}
            </div>
          )}
          {ts.installed === true && !ts.installing && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>Tailscale installed
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleConnectTailscale()} fullWidth>Connect</Button>
                <Button onClick={() => dispatchTs({ type: "SET", payload: { showModal: false } })} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}
          {ts.status && <StatusAlert status={ts.status} />}
        </div>
      </Modal>

      <Modal isOpen={ts.showDisableModal} title="Disable Tailscale" onClose={() => !ts.loading && dispatchTs({ type: "SET", payload: { showDisableModal: false } })}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Tailscale Funnel will be stopped. Remote access via Tailscale URL will stop working.</p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTailscale} fullWidth disabled={ts.loading} variant="danger">{ts.loading ? "Disabling..." : "Disable"}</Button>
            <Button onClick={() => dispatchTs({ type: "SET", payload: { showDisableModal: false } })} variant="ghost" fullWidth disabled={ts.loading}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!settings.confirmState}
        onClose={() => dispatchSettings({ type: "SET", payload: { confirmState: null } })}
        onConfirm={settings.confirmState?.onConfirm}
        title={settings.confirmState?.title || "Confirm"}
        message={settings.confirmState?.message}
        variant="danger"
      />
    </>
  );
}

// ── useEndpointHandlers hook ──────────────────────────────────────────────────

function useEndpointHandlers({ tunnel, dispatchTunnel, ts, dispatchTs, settings, dispatchSettings, tsLogRef }) {
  const tsInstallLogRef = useRef([]);
  const tunnelMissRef = useRef(0);
  const tsMissRef = useRef(0);
  const tunnelClientReachableRef = useRef(false);
  const tsClientReachableRef = useRef(false);
  const tunnelEverReachableRef = useRef(false);
  const tsEverReachableRef = useRef(false);

  // Auto-scroll install log
  useEffect(() => {
    if (tsLogRef.current) tsLogRef.current.scrollTop = tsLogRef.current.scrollHeight;
  }, [ts.installLog, tsLogRef]);

  // Client-side reachable only. Miss-debounce: only flip to false after N consecutive misses.
  const updateReachable = useCallback((clientRef, missRef, dispatch, everRef) => {
    const reachable = clientRef.current;
    if (reachable) {
      missRef.current = 0;
      dispatch({ type: "SET", payload: { reachable: true } });
      if (!everRef.current) {
        everRef.current = true;
        dispatch({ type: "SET", payload: { everReachable: true } });
      }
    } else {
      missRef.current += 1;
      if (missRef.current >= REACHABLE_MISS_THRESHOLD) dispatch({ type: "SET", payload: { reachable: false } });
    }
  }, []);

  // Trust user intent (settingsEnabled): UI stays "enabled" while watchdog restarts process
  const syncTunnelStatus = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/tunnel/status", { cache: "no-store" });
      if (!statusRes.ok) return;
      const data = await statusRes.json();
      const tEnabled = data.tunnel?.settingsEnabled ?? data.tunnel?.enabled ?? false;
      const tUrl = data.tunnel?.tunnelUrl || "";
      dispatchTunnel({ type: "SET", payload: { url: tUrl, publicUrl: data.tunnel?.publicUrl || "", enabled: tEnabled } });
      updateReachable(tunnelClientReachableRef, tunnelMissRef, dispatchTunnel, tunnelEverReachableRef);

      const tsEn = data.tailscale?.settingsEnabled ?? data.tailscale?.enabled ?? false;
      const tsUrlVal = data.tailscale?.tunnelUrl || "";
      dispatchTs({ type: "SET", payload: { url: tsUrlVal, enabled: tsEn } });
      updateReachable(tsClientReachableRef, tsMissRef, dispatchTs, tsEverReachableRef);
    } catch { /* ignore poll errors */ }
  }, [updateReachable, dispatchTunnel, dispatchTs]);

  const loadSettings = useCallback(async () => {
    dispatchTunnel({ type: "SET", payload: { checking: true } });
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/tunnel/status", { cache: "no-store" })
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        dispatchSettings({ type: "SET", payload: {
          requireApiKey: data.requireApiKey || false,
          requireLogin: data.requireLogin !== false,
          hasPassword: data.hasPassword || false,
          tunnelDashboardAccess: data.tunnelDashboardAccess || false,
        } });
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        const tEnabled = data.tunnel?.settingsEnabled ?? data.tunnel?.enabled ?? false;
        const tUrl = data.tunnel?.tunnelUrl || "";
        dispatchTunnel({ type: "SET", payload: { url: tUrl, publicUrl: data.tunnel?.publicUrl || "", enabled: tEnabled } });
        updateReachable(tunnelClientReachableRef, tunnelMissRef, dispatchTunnel, tunnelEverReachableRef);

        const tsEn = data.tailscale?.settingsEnabled ?? data.tailscale?.enabled ?? false;
        const tsUrlVal = data.tailscale?.tunnelUrl || "";
        dispatchTs({ type: "SET", payload: { url: tsUrlVal, enabled: tsEn } });
        updateReachable(tsClientReachableRef, tsMissRef, dispatchTs, tsEverReachableRef);
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    } finally {
      dispatchTunnel({ type: "SET", payload: { checking: false } });
    }
  }, [updateReachable, dispatchSettings, dispatchTunnel, dispatchTs]);

  const handleTunnelDashboardAccess = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tunnelDashboardAccess: value }),
      });
      if (res.ok) dispatchSettings({ type: "SET", payload: { tunnelDashboardAccess: value } });
    } catch (error) {
      console.log("Error updating tunnelDashboardAccess:", error);
    }
  };

  const handleRequireApiKey = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireApiKey: value }),
      });
      if (res.ok) dispatchSettings({ type: "SET", payload: { requireApiKey: value } });
    } catch (error) {
      console.log("Error updating requireApiKey:", error);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const keysRes = await fetch("/api/keys");
      const keysData = await keysRes.json();
      if (keysRes.ok) {
        dispatchSettings({ type: "SET", payload: { keys: keysData.keys || [] } });
      }
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      dispatchSettings({ type: "SET", payload: { loading: false } });
    }
  }, [dispatchSettings]);

  // ── Cloudflare Tunnel handlers
  // Ping tunnel health until reachable. Race multiple URLs (shortlink + direct) — 1 OK is enough.
  const pingTunnelHealth = async (...urls) => {
    dispatchTunnel({ type: "SET", payload: { loading: true, progress: "Waiting for tunnel ready..." } });
    const targets = []; for (const u of urls) { if (Boolean(u)) targets.push(`${u}/api/health`); }
    const start = Date.now();
    while (Date.now() - start < TUNNEL_PING_MAX_MS) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: polling interval between attempts
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      const ok = await Promise.any(targets.map(async (h) => {
        const p = await fetch(h, { mode: "cors", cache: "no-store" });
        if (p.ok) return true;
        throw new Error("not ready");
      })).catch(() => false);
      if (ok) {
        dispatchTunnel({ type: "SET", payload: { enabled: true, loading: false, progress: "" } });
        return true;
      }
      // Every 5 pings (~10s), check if backend process still alive
      if ((Date.now() - start) % 10000 < TUNNEL_PING_INTERVAL_MS) {
        try {
          const statusRes = await fetch("/api/tunnel/status");
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.tunnel?.enabled) {
              dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: "Tunnel process stopped unexpectedly." }, loading: false, progress: "" } });
              return false;
            }
          }
        } catch { /* ignore */ }
      }
    }
    dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: "Tunnel created but not reachable. Please try again." }, loading: false, progress: "" } });
    return false;
  };

  const handleEnableTunnel = async () => {
    dispatchTunnel({ type: "SET", payload: { showEnableModal: false, loading: true, status: null, progress: "Creating tunnel..." } });

    // Poll download progress while enable request is pending
    let polling = true;
    const pollProgress = async () => {
      while (polling) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: polling tunnel status at intervals
        try {
          const r = await fetch("/api/tunnel/status");
          if (r.ok) {
            const s = await r.json();
            if (s.download?.downloading) {
              dispatchTunnel({ type: "SET", payload: { progress: `Downloading cloudflared... ${s.download.progress}%` } });
            } else if (polling) {
              dispatchTunnel({ type: "SET", payload: { progress: "Creating tunnel..." } });
            }
          }
        } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
    };
    pollProgress();

    try {
      const res = await fetch("/api/tunnel/enable", { method: "POST" });
      polling = false;
      const data = await res.json();
      if (!res.ok) {
        dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: data.error || "Failed to enable tunnel" } } });
        return;
      }

      const url = data.tunnelUrl;
      if (!url) {
        dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: "No tunnel URL returned" } } });
        return;
      }

      dispatchTunnel({ type: "SET", payload: { url, publicUrl: data.publicUrl || "" } });
      await pingTunnelHealth(data.publicUrl, url);
    } catch (error) {
      dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: error.message } } });
    } finally {
      polling = false;
      dispatchTunnel({ type: "SET", payload: { loading: false, progress: "" } });
    }
  };

  const handleDisableTunnel = async () => {
    dispatchTunnel({ type: "SET", payload: { loading: true, status: null } });
    try {
      const res = await fetch("/api/tunnel/disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        dispatchTunnel({ type: "SET", payload: { enabled: false, url: "", showDisableModal: false, status: { type: "success", message: "Tunnel disabled" } } });
      } else {
        dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: data.error || "Failed to disable tunnel" } } });
      }
    } catch (error) {
      dispatchTunnel({ type: "SET", payload: { status: { type: "error", message: error.message } } });
    } finally {
      dispatchTunnel({ type: "SET", payload: { loading: false } });
    }
  };

  // ── Tailscale handlers
  const checkTailscaleInstalled = async () => {
    dispatchTs({ type: "SET", payload: { installed: null } });
    try {
      const res = await fetch("/api/tunnel/tailscale-check");
      if (res.ok) {
        const data = await res.json();
        dispatchTs({ type: "SET", payload: { installed: data.installed } });
        return data;
      }
    } catch { /* ignore */ }
    dispatchTs({ type: "SET", payload: { installed: false } });
    return { installed: false };
  };

  const handleInstallTailscale = async () => {
    tsInstallLogRef.current = [];
    dispatchTs({ type: "SET", payload: { installing: true, status: null, installLog: [] } });
    try {
      const res = await fetch("/api/tunnel/tailscale-install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudoPassword: ts.sudoPassword }),
      });
      dispatchTs({ type: "SET", payload: { sudoPassword: "" } });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: streaming chunks from reader
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "progress";
          let data = null;
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) {
              try { data = JSON.parse(line.slice(6)); } catch { /* skip */ }
            }
          }
          if (!data) continue;
          if (event === "progress") {
            tsInstallLogRef.current = [...tsInstallLogRef.current.slice(-50), data.message];
            dispatchTs({ type: "SET", payload: { installLog: tsInstallLogRef.current } });
          } else if (event === "done") {
            dispatchTs({ type: "SET", payload: { installed: true, installing: false, showModal: false } });
            handleConnectTailscale();
            return;
          } else if (event === "error") {
            dispatchTs({ type: "SET", payload: { status: { type: "error", message: data.error || "Install failed" } } });
          }
        }
      }
    } catch (e) {
      dispatchTs({ type: "SET", payload: { status: { type: "error", message: e.message } } });
    } finally {
      dispatchTs({ type: "SET", payload: { installing: false } });
    }
  };

  // Ping Tailscale health until reachable
  const pingTsHealth = async (url) => {
    dispatchTs({ type: "SET", payload: { progress: "Waiting for Tailscale ready..." } });
    const healthUrl = `${url}/api/health`;
    const start = Date.now();
    while (Date.now() - start < TUNNEL_PING_MAX_MS) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: polling health at intervals
      await new Promise((r) => setTimeout(r, TUNNEL_PING_INTERVAL_MS));
      try {
        const ping = await fetch(healthUrl, { mode: "no-cors", cache: "no-store" });
        if (ping.ok || ping.type === "opaque") return true;
      } catch { /* not ready yet */ }
    }
    return false;
  };

  // Show inline login button instead of auto-opening popup (browsers block popups
  // opened after async work because the user gesture is lost).
  const requestUserAuth = (url, label) => {
    dispatchTs({ type: "SET", payload: { authUrl: url, authLabel: label } });
  };

  const clearUserAuth = () => {
    dispatchTs({ type: "SET", payload: { authUrl: "", authLabel: "" } });
  };

  const handleConnectTailscale = async () => {
    dispatchTs({ type: "SET", payload: { showModal: false, connecting: true, loading: true, status: null, progress: "Connecting..." } });
    clearUserAuth();
    try {
      const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        dispatchTs({ type: "SET", payload: { url: data.tunnelUrl || "" } });
        const reachable = await pingTsHealth(data.tunnelUrl);
        dispatchTs({ type: "SET", payload: { enabled: true, status: reachable ? null : { type: "warning", message: "Connected but not reachable yet." } } });
        return;
      }

      if (data.needsLogin && data.authUrl) {
        requestUserAuth(data.authUrl, "Open Login Page");
        dispatchTs({ type: "SET", payload: { progress: "Login required — click \"Open Login Page\" to continue" } });
        for (let i = 0; i < 40; i++) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: polling login status at intervals
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const r2 = await fetch("/api/tunnel/tailscale-check");
            if (r2.ok) {
              const check = await r2.json();
              if (check.loggedIn) {
                clearUserAuth();
                dispatchTs({ type: "SET", payload: { progress: "Starting funnel..." } });
                const res2 = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
                const data2 = await res2.json();
                if (res2.ok && data2.success) {
                  dispatchTs({ type: "SET", payload: { url: data2.tunnelUrl || "" } });
                  const ok2 = await pingTsHealth(data2.tunnelUrl);
                  dispatchTs({ type: "SET", payload: { enabled: true, status: ok2 ? null : { type: "warning", message: "Connected but not reachable yet." } } });
                } else if (data2.funnelNotEnabled && data2.enableUrl) {
                  await pollFunnelEnable(data2.enableUrl);
                } else {
                  dispatchTs({ type: "SET", payload: { status: { type: "error", message: data2.error || "Failed to start funnel" } } });
                }
                return;
              }
            }
          } catch { /* retry */ }
        }
        clearUserAuth();
        dispatchTs({ type: "SET", payload: { status: { type: "error", message: "Login timed out. Please try again." } } });
        return;
      }

      if (data.funnelNotEnabled && data.enableUrl) {
        await pollFunnelEnable(data.enableUrl);
        return;
      }

      dispatchTs({ type: "SET", payload: { status: { type: "error", message: data.error || "Failed to connect" } } });
    } catch (error) {
      dispatchTs({ type: "SET", payload: { status: { type: "error", message: error.message } } });
    } finally {
      dispatchTs({ type: "SET", payload: { loading: false, connecting: false, progress: "" } });
      clearUserAuth();
    }
  };

  const pollFunnelEnable = async (enableUrl) => {
    requestUserAuth(enableUrl, "Open Funnel Settings");
    dispatchTs({ type: "SET", payload: { progress: "Click \"Open Funnel Settings\" to enable Funnel..." } });
    for (let i = 0; i < 40; i++) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: polling funnel enable at intervals
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch("/api/tunnel/tailscale-enable", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.success) {
          clearUserAuth();
          dispatchTs({ type: "SET", payload: { url: data.tunnelUrl || "" } });
          const ok3 = await pingTsHealth(data.tunnelUrl);
          dispatchTs({ type: "SET", payload: { enabled: true, status: ok3 ? null : { type: "warning", message: "Connected but not reachable yet." } } });
          return;
        }
        if (data.funnelNotEnabled) continue;
        if (data.error) {
          clearUserAuth();
          dispatchTs({ type: "SET", payload: { status: { type: "error", message: data.error } } });
          return;
        }
      } catch { /* retry */ }
    }
    clearUserAuth();
    dispatchTs({ type: "SET", payload: { status: { type: "error", message: "Timed out waiting for Funnel to be enabled." } } });
  };

  const handleDisableTailscale = async () => {
    dispatchTs({ type: "SET", payload: { loading: true, status: null } });
    try {
      const res = await fetch("/api/tunnel/tailscale-disable", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        dispatchTs({ type: "SET", payload: { enabled: false, url: "", showDisableModal: false, status: { type: "success", message: "Tailscale disabled" } } });
      } else {
        dispatchTs({ type: "SET", payload: { status: { type: "error", message: data.error || "Failed to disable Tailscale" } } });
      }
    } catch (e) {
      dispatchTs({ type: "SET", payload: { status: { type: "error", message: e.message } } });
    } finally {
      dispatchTs({ type: "SET", payload: { loading: false } });
    }
  };

  const handleOpenTsModal = async () => {
    dispatchTs({ type: "SET", payload: { status: null, installLog: [] } });
    const data = await checkTailscaleInstalled();
    if (data?.installed && data?.hasCachedPassword) {
      handleConnectTailscale();
    } else {
      dispatchTs({ type: "SET", payload: { showModal: true } });
    }
  };

  // ── Key handlers
  const handleCreateKey = async () => {
    if (!settings.newKeyName.trim()) return;

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: settings.newKeyName }),
      });
      const data = await res.json();

      if (res.ok) {
        dispatchSettings({ type: "SET", payload: { createdKey: data.key, newKeyName: "", showAddModal: false } });
        await fetchData();
      }
    } catch (error) {
      console.log("Error creating key:", error);
    }
  };

  const handleDeleteKey = async (id) => {
    dispatchSettings({ type: "SET", payload: {
      confirmState: {
        title: "Delete API Key",
        message: "Delete this API key?",
        onConfirm: async () => {
          dispatchSettings({ type: "SET", payload: { confirmState: null } });
          try {
            const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
            if (res.ok) {
              dispatchSettings({ type: "SET", payload: { keys: settings.keys.filter((k) => k.id !== id) } });
              dispatchSettings({ type: "SET", payload: { visibleKeys: (() => { const next = new Set(settings.visibleKeys); next.delete(id); return next; })() } });
            }
          } catch (error) {
            console.log("Error deleting key:", error);
          }
        }
      }
    } });
  };

  const handleToggleKey = async (id, isActive) => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        dispatchSettings({ type: "SET", payload: { keys: settings.keys.map(k => k.id === id ? { ...k, isActive } : k) } });
      }
    } catch (error) {
      console.log("Error toggling key:", error);
    }
  };

  const toggleKeyVisibility = (keyId) => {
    dispatchSettings({ type: "SET", payload: {
      visibleKeys: (() => {
        const next = new Set(settings.visibleKeys);
        if (next.has(keyId)) next.delete(keyId);
        else next.add(keyId);
        return next;
      })()
    } });
  };

  // Status poll: only while degraded (not yet reachable). Stop once healthy to avoid spam.
  const handleSyncEvent = useEffectEvent(() => syncTunnelStatus());
  useEffect(() => {
    const anyEnabled = tunnel.enabled || ts.enabled;
    if (!anyEnabled) return;
    const tunnelHealthy = !tunnel.enabled || tunnel.reachable;
    const tsHealthy = !ts.enabled || ts.reachable;
    const allHealthy = tunnelHealthy && tsHealthy;
    const onVisible = () => { if (!document.hidden) handleSyncEvent(); };
    document.addEventListener("visibilitychange", onVisible);
    if (allHealthy) return () => document.removeEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => { if (!document.hidden) handleSyncEvent(); }, STATUS_POLL_FAST_MS);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tunnel.enabled, ts.enabled, tunnel.reachable, ts.reachable]);

  // Browser-side periodic ping: probes tunnel/tailscale URLs directly so UI stays
  // "reachable" even when backend DNS (1.1.1.1) hiccups on *.ts.net or *.trycloudflare.com.
  useEffect(() => {
    const probeBoth = async () => {
      if (document.hidden) return;
      if (tunnel.enabled && (tunnel.url || tunnel.publicUrl)) {
        const ok = await clientPingAny(tunnel.publicUrl, tunnel.url);
        tunnelClientReachableRef.current = ok;
        if (ok) { tunnelMissRef.current = 0; dispatchTunnel({ type: "SET", payload: { reachable: true } }); if (!tunnelEverReachableRef.current) { tunnelEverReachableRef.current = true; dispatchTunnel({ type: "SET", payload: { everReachable: true } }); } }
        else { tunnelMissRef.current += 1; if (tunnelMissRef.current >= REACHABLE_MISS_THRESHOLD) dispatchTunnel({ type: "SET", payload: { reachable: false } }); }
      } else {
        tunnelClientReachableRef.current = false;
      }
      if (ts.enabled && ts.url) {
        const ok = await clientPingUrl(ts.url);
        tsClientReachableRef.current = ok;
        if (ok) { tsMissRef.current = 0; dispatchTs({ type: "SET", payload: { reachable: true } }); if (!tsEverReachableRef.current) { tsEverReachableRef.current = true; dispatchTs({ type: "SET", payload: { everReachable: true } }); } }
        else { tsMissRef.current += 1; if (tsMissRef.current >= REACHABLE_MISS_THRESHOLD) dispatchTs({ type: "SET", payload: { reachable: false } }); }
      } else {
        tsClientReachableRef.current = false;
      }
    };
    const anyEnabled = (tunnel.enabled && (tunnel.url || tunnel.publicUrl)) || (ts.enabled && ts.url);
    if (!anyEnabled) return;
    probeBoth();
    const tunnelHealthy = !tunnel.enabled || tunnel.reachable;
    const tsHealthy = !ts.enabled || ts.reachable;
    if (tunnelHealthy && tsHealthy) return;
    const id = setInterval(probeBoth, CLIENT_PING_FAST_MS);
    return () => clearInterval(id);
  }, [tunnel.enabled, tunnel.url, tunnel.publicUrl, ts.enabled, ts.url, tunnel.reachable, ts.reachable, dispatchTunnel, dispatchTs]);

  return {
    loadSettings,
    handleTunnelDashboardAccess,
    handleRequireApiKey,
    fetchData,
    handleEnableTunnel,
    handleDisableTunnel,
    handleInstallTailscale,
    handleConnectTailscale,
    handleDisableTailscale,
    handleOpenTsModal,
    clearUserAuth,
    handleCreateKey,
    handleDeleteKey,
    handleToggleKey,
    toggleKeyVisibility,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function APIPageClient({ machineId }) {
  const [tunnel, dispatchTunnel] = useReducer(tunnelReducer, tunnelInit);
  const [ts, dispatchTs] = useReducer(tailscaleReducer, tailscaleInit);
  const [settings, dispatchSettings] = useReducer(settingsReducer, settingsInit);

  const tsLogRef = useRef(null);
  const [isRemoteHost] = useState(() =>
    typeof window !== "undefined" && !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
  const { copied, copy } = useCopyToClipboard();
  const [baseUrl] = useState(() =>
    typeof window !== "undefined" ? `${window.location.origin}/v1` : "/v1"
  );

  const {
    loadSettings, handleTunnelDashboardAccess, handleRequireApiKey,
    fetchData, handleEnableTunnel, handleDisableTunnel, handleInstallTailscale,
    handleConnectTailscale, handleDisableTailscale, handleOpenTsModal, clearUserAuth,
    handleCreateKey, handleDeleteKey, handleToggleKey, toggleKeyVisibility,
  } = useEndpointHandlers({ tunnel, dispatchTunnel, ts, dispatchTs, settings, dispatchSettings, tsLogRef });

  const isLoginUnsafe = !settings.requireLogin || !settings.hasPassword;
  const unsafeReason = !settings.requireLogin
    ? "Enable \"Require login\" and set a custom password before activating the tunnel."
    : "Change the default dashboard password before activating the tunnel.";

  useEffect(() => {
    fetchData();
    loadSettings();
  }, [loadSettings, fetchData]);

  if (settings.loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EndpointCard
        currentEndpoint={baseUrl}
        copied={copied}
        copy={copy}
        tunnel={tunnel}
        dispatchTunnel={dispatchTunnel}
        ts={ts}
        dispatchTs={dispatchTs}
        isLoginUnsafe={isLoginUnsafe}
        unsafeReason={unsafeReason}
        requireApiKey={settings.requireApiKey}
        requireLogin={settings.requireLogin}
        hasPassword={settings.hasPassword}
        tunnelDashboardAccess={settings.tunnelDashboardAccess}
        onTunnelDashboardAccess={handleTunnelDashboardAccess}
        onOpenTsModal={handleOpenTsModal}
        onClearUserAuth={clearUserAuth}
      />

      <ApiKeysCard
        keys={settings.keys}
        visibleKeys={settings.visibleKeys}
        copied={copied}
        copy={copy}
        requireApiKey={settings.requireApiKey}
        isRemoteHost={isRemoteHost}
        onRequireApiKey={handleRequireApiKey}
        onShowAddModal={() => dispatchSettings({ type: "SET", payload: { showAddModal: true } })}
        onDeleteKey={handleDeleteKey}
        onToggleKey={handleToggleKey}
        onToggleKeyVisibility={toggleKeyVisibility}
        setConfirmState={(val) => dispatchSettings({ type: "SET", payload: { confirmState: val } })}
      />

      <EndpointModals
        settings={settings}
        dispatchSettings={dispatchSettings}
        tunnel={tunnel}
        dispatchTunnel={dispatchTunnel}
        ts={ts}
        dispatchTs={dispatchTs}
        copied={copied}
        copy={copy}
        handleCreateKey={handleCreateKey}
        handleEnableTunnel={handleEnableTunnel}
        handleDisableTunnel={handleDisableTunnel}
        handleInstallTailscale={handleInstallTailscale}
        handleConnectTailscale={handleConnectTailscale}
        handleDisableTailscale={handleDisableTailscale}
        tsLogRef={tsLogRef}
      />
    </div>
  );
}


APIPageClient.propTypes = {
  machineId: PropTypes.string.isRequired,
};
