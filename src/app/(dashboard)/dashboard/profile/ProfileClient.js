"use client";

import { useState, useEffect, useReducer, useRef } from "react";
import { Card, Button, Toggle, Input } from "@/shared/components";
import Modal, { ConfirmModal } from "@/shared/components/Modal";
import LanguageSwitcher from "@/shared/components/LanguageSwitcher";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { LOCALE_FLAGS } from "@/shared/constants/locales";

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

async function handleLogout() {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      window.location.assign("/login");
    }
  } catch (err) {
    console.error("Failed to logout:", err);
  }
}

function profileReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "MERGE_NESTED":
      return { ...state, [action.field]: { ...state[action.field], ...action.patch } };
    default:
      return state;
  }
}

async function patchSettingField(setSettings, field, value) {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });
  if (res.ok) setSettings(prev => ({ ...prev, [field]: value }));
}

function AccountFooter({ onShutdown, onLogout }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" fullWidth icon="power_settings_new"
          onClick={onShutdown}
          className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
        >Shutdown</Button>
        <Button variant="outline" fullWidth icon="logout" onClick={onLogout}>Logout</Button>
      </div>
      <div className="text-center text-xs sm:text-sm text-text-muted py-4">
        <p>{APP_CONFIG.name} v{APP_CONFIG.version}</p>
        <p className="mt-1">Local Mode - All data stored on your machine</p>
      </div>
    </>
  );
}

function ProfileModals({ langOpen, setField, locale, shutdownOpen, handleShutdown, isShuttingDown, dbAuth, mergeNested, handleDbAuthConfirm, dbLoading }) {
  return (
    <>
      <LanguageSwitcher
        hideTrigger isOpen={langOpen}
        onClose={(next) => { setField("langOpen", false); setField("locale", next); }}
      />
      <ConfirmModal
        isOpen={shutdownOpen} onClose={() => setField("shutdownOpen", false)}
        onConfirm={handleShutdown} title="Close Proxy"
        message="Are you sure you want to close the proxy server?"
        confirmText="Close" cancelText="Cancel" variant="danger" loading={isShuttingDown}
      />
      <Modal
        isOpen={dbAuth.open}
        onClose={() => setField("dbAuth", { open: false, mode: "", password: "" })}
        title="Confirm Password" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setField("dbAuth", { open: false, mode: "", password: "" })} disabled={dbLoading}>Cancel</Button>
            <Button variant="primary" onClick={handleDbAuthConfirm} loading={dbLoading} disabled={!dbAuth.password}>Confirm</Button>
          </>
        }
      >
        <p className="text-text-muted mb-3 text-sm">
          Enter your current password to {dbAuth.mode === "export" ? "export" : "import"} the database.
        </p>
        <Input
          type="password" value={dbAuth.password}
          onChange={(e) => mergeNested("dbAuth", { password: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && dbAuth.password) handleDbAuthConfirm(); }}
          placeholder="Current password"
        />
      </Modal>
    </>
  );
}

function LocalModeCard({ theme, setTheme, dbLoading, dbStatus, importFileRef, handleImportDatabase, setField }) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="size-10 sm:size-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">computer</span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">Local Mode</h2>
            <p className="text-sm text-text-muted">Running on your machine</p>
          </div>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5 w-full sm:w-auto">
          {["light", "dark", "system"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTheme(option)}
              className={cn(
                "flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md font-medium transition-all flex-1 sm:flex-initial",
                theme === option
                  ? "bg-white dark:bg-white/10 text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">
                {option === "light" ? "light_mode" : option === "dark" ? "dark_mode" : "contrast"}
              </span>
              <span className="capitalize text-xs sm:text-sm">{option}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-bg border border-border gap-2">
          <div>
            <p className="font-medium text-sm sm:text-base">Database Location</p>
            <p className="text-xs sm:text-sm text-text-muted font-mono break-all">~/.9router/db/data.sqlite</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" icon="download"
            onClick={() => setField("dbAuth", { open: true, mode: "export", password: "" })}
            loading={dbLoading} className="w-full sm:w-auto"
          >Download Backup</Button>
          <Button variant="outline" icon="upload"
            onClick={() => importFileRef.current?.click()}
            disabled={dbLoading} className="w-full sm:w-auto"
          >Import Backup</Button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={handleImportDatabase} aria-label="Import backup file"
          />
        </div>
        {dbStatus.message && (
          <p className={`text-sm ${dbStatus.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
            {dbStatus.message}
          </p>
        )}
      </div>
    </Card>
  );
}

function LanguageCard({ locale, setField }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">language</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Language</h3>
      </div>
      <button
        type="button"
        onClick={() => { setField("locale", getLocaleFromCookie()); setField("langOpen", true); }}
        className="flex items-center justify-between w-full p-3 rounded-lg bg-bg border border-border hover:border-primary/50 transition-colors"
        data-i18n-skip="true"
      >
        <span className="text-sm text-text-muted">Display language</span>
        <span className="text-2xl">{LOCALE_FLAGS[locale] || "\u{1F310}"}</span>
      </button>
    </Card>
  );
}

function SecurityCard({ settings, loading, passwords, passStatus, passLoading, updateRequireLogin, handlePasswordChange, mergeNested }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <span className="material-symbols-outlined text-[20px]">shield</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Security</h3>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base">Require login</p>
            <p className="text-xs sm:text-sm text-text-muted">
              When ON, dashboard requires password. When OFF, access without login.
            </p>
          </div>
          <Toggle checked={settings.requireLogin === true}
            onChange={() => updateRequireLogin(!settings.requireLogin)} disabled={loading}
          />
        </div>
        {settings.requireLogin === true && (
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4 pt-4 border-t border-border/50">
            {settings.hasPassword && (
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-current-password" className="text-xs sm:text-sm font-medium">Current Password</label>
                <Input id="profile-current-password" type="password" placeholder="Enter current password"
                  value={passwords.current} onChange={(e) => mergeNested("passwords", { current: e.target.value })} required
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-new-password" className="text-xs sm:text-sm font-medium">New Password</label>
                <Input id="profile-new-password" type="password" placeholder="Enter new password"
                  value={passwords.new} onChange={(e) => mergeNested("passwords", { new: e.target.value })} required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-confirm-password" className="text-xs sm:text-sm font-medium">Confirm New Password</label>
                <Input id="profile-confirm-password" type="password" placeholder="Confirm new password"
                  value={passwords.confirm} onChange={(e) => mergeNested("passwords", { confirm: e.target.value })} required
                />
              </div>
            </div>
            {passStatus.message && (
              <p className={`text-xs sm:text-sm ${passStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                {passStatus.message}
              </p>
            )}
            <div className="pt-2">
              <Button type="submit" variant="primary" loading={passLoading} className="w-full sm:w-auto">
                {settings.hasPassword ? "Update Password" : "Set Password"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

function OidcCard({ settings, loading, oidcForm, oidcClientSecret, oidcStatus, oidcLoading, oidcTestLoading, oidcTestStatus, oidcRedirectUri, oidcExpanded, updateOidcForm, saveOidcSettings, testOidcConnection, setField }) {
  return (
    <Card>
      <button type="button" onClick={() => setField("oidcExpanded", !oidcExpanded)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">lock_open</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold">OIDC Dashboard Login</h3>
          <p className="text-xs text-text-muted">
            {settings.authMode === "oidc" ? "OIDC active" : settings.authMode === "both" ? "Password + OIDC active" : "Optional SSO via Authentik/Keycloak/Google"}
          </p>
        </div>
        <span className="material-symbols-outlined text-text-muted shrink-0">
          {oidcExpanded ? "expand_less" : "expand_more"}
        </span>
      </button>
      {oidcExpanded && (
      <div className="flex flex-col gap-4 mt-4">
        <p className="text-xs sm:text-sm text-text-muted">
          Use Authentik or any OIDC provider to sign in to the dashboard. You can enable password-only, OIDC-only, or both for the dashboard; model API access still uses API keys.
        </p>

        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm sm:text-base">Auth Mode</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: "password", title: "Password only", desc: "Keep the legacy password login." },
              { value: "oidc", title: "OIDC only", desc: "Require OIDC for dashboard access." },
              { value: "both", title: "Both", desc: "Allow either password or OIDC." },
            ].map((option) => {
              const active = oidcForm.authMode === option.value;
              return (
                <button key={option.value} type="button"
                  onClick={() => updateOidcForm("authMode", option.value)}
                  className={cn(
                    "text-left rounded-lg border p-3 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border bg-bg hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  disabled={loading || oidcLoading}
                >
                  <p className="font-medium text-sm sm:text-base">{option.title}</p>
                  <p className="text-xs sm:text-sm text-text-muted mt-1">{option.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="oidc-issuer-url" className="font-medium text-sm sm:text-base">Issuer URL</label>
            <Input id="oidc-issuer-url" placeholder="https://auth.example.com/application/o/9router/"
              value={oidcForm.oidcIssuerUrl} onChange={(e) => updateOidcForm("oidcIssuerUrl", e.target.value)} disabled={loading || oidcLoading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="oidc-client-id" className="font-medium text-sm sm:text-base">Client ID</label>
            <Input id="oidc-client-id" placeholder="9router-dashboard"
              value={oidcForm.oidcClientId} onChange={(e) => updateOidcForm("oidcClientId", e.target.value)} disabled={loading || oidcLoading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="oidc-client-secret" className="font-medium text-sm sm:text-base">Client Secret</label>
            <Input id="oidc-client-secret" type="password" placeholder="Leave blank to keep existing secret"
              value={oidcClientSecret} onChange={(e) => setField("oidcClientSecret", e.target.value)} disabled={loading || oidcLoading}
            />
            <p className="text-xs sm:text-sm text-text-muted">This value is write-only after saving.</p>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="oidc-scopes" className="font-medium text-sm sm:text-base">Scopes</label>
            <Input id="oidc-scopes" placeholder="openid profile email"
              value={oidcForm.oidcScopes} onChange={(e) => updateOidcForm("oidcScopes", e.target.value)} disabled={loading || oidcLoading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="oidc-login-label" className="font-medium text-sm sm:text-base">Login Button Label</label>
            <Input id="oidc-login-label" placeholder="Sign in with OIDC"
              value={oidcForm.oidcLoginLabel} onChange={(e) => updateOidcForm("oidcLoginLabel", e.target.value)} disabled={loading || oidcLoading}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg p-3 text-xs sm:text-sm text-text-muted">
          <p className="font-medium text-text-main mb-1">Redirect URI</p>
          <code className="block break-all font-mono">{oidcRedirectUri}</code>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50">
          <Button type="button" variant="primary" loading={oidcLoading} onClick={() => saveOidcSettings()} className="w-full sm:w-auto">Save auth mode</Button>
          <Button type="button" variant="outline" loading={oidcTestLoading} onClick={testOidcConnection} className="w-full sm:w-auto">Test connection</Button>
        </div>

        {oidcTestStatus.message && (
          <p className={`text-xs sm:text-sm ${oidcTestStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>{oidcTestStatus.message}</p>
        )}
        {oidcStatus.message && (
          <p className={`text-xs sm:text-sm ${oidcStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>{oidcStatus.message}</p>
        )}
        {settings.authMode === "oidc" && (
          <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">OIDC login is currently active. Password login is disabled until you switch back.</p>
        )}
        {settings.authMode === "both" && (
          <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Password and OIDC login are both active.</p>
        )}
      </div>
      )}
    </Card>
  );
}

function RoutingCard({ settings, loading, updateFallbackStrategy, updateComboStrategy, updateStickyLimit, updateComboStickyLimit }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">route</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Routing Strategy</h3>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base">Round Robin</p>
            <p className="text-xs sm:text-sm text-text-muted">Cycle through accounts to distribute load</p>
          </div>
          <Toggle checked={settings.fallbackStrategy === "round-robin"}
            onChange={() => updateFallbackStrategy(settings.fallbackStrategy === "round-robin" ? "fill-first" : "round-robin")}
            disabled={loading}
          />
        </div>
        {settings.fallbackStrategy === "round-robin" && (
          <div className="flex items-start sm:items-center justify-between gap-4 pt-2 border-t border-border/50">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base">Sticky Limit</p>
              <p className="text-xs sm:text-sm text-text-muted">Calls per account before switching</p>
            </div>
            <Input type="number" min="1" max="10" value={settings.stickyRoundRobinLimit || 3}
              onChange={(e) => updateStickyLimit(e.target.value)} disabled={loading}
              className="w-16 sm:w-20 text-center shrink-0"
            />
          </div>
        )}
        <div className="flex items-start sm:items-center justify-between gap-4 pt-4 border-t border-border/50">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base">Combo Round Robin</p>
            <p className="text-xs sm:text-sm text-text-muted">Cycle through providers in combos instead of always starting with first</p>
          </div>
          <Toggle checked={settings.comboStrategy === "round-robin"}
            onChange={() => updateComboStrategy(settings.comboStrategy === "round-robin" ? "fallback" : "round-robin")}
            disabled={loading}
          />
        </div>
        {settings.comboStrategy === "round-robin" && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div>
              <p className="font-medium">Combo Sticky Limit</p>
              <p className="text-sm text-text-muted">Calls per combo model before switching</p>
            </div>
            <Input type="number" min="1" max="100" value={settings.comboStickyRoundRobinLimit || 1}
              onChange={(e) => updateComboStickyLimit(e.target.value)} disabled={loading}
              className="w-20 text-center"
            />
          </div>
        )}
        <p className="text-xs text-text-muted italic pt-2 border-t border-border/50">
          {settings.fallbackStrategy === "round-robin"
            ? `Currently distributing requests across all available accounts with ${settings.stickyRoundRobinLimit || 3} calls per account.`
            : "Currently using accounts in priority order (Fill First)."}
          {settings.comboStrategy === "round-robin"
            ? ` Combos rotate after ${settings.comboStickyRoundRobinLimit || 1} call${(settings.comboStickyRoundRobinLimit || 1) === 1 ? "" : "s"} per model.`
            : " Combos always start with their first model."}
        </p>
      </div>
    </Card>
  );
}

function NetworkCard({ settings, loading, proxyForm, proxyStatus, proxyLoading, proxyTestLoading, updateOutboundProxy, testOutboundProxy, updateOutboundProxyEnabled, mergeNested }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">wifi</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Network</h3>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base">Outbound Proxy</p>
            <p className="text-xs sm:text-sm text-text-muted">Enable proxy for OAuth + provider outbound requests.</p>
          </div>
          <Toggle checked={settings.outboundProxyEnabled === true}
            onChange={() => updateOutboundProxyEnabled(!(settings.outboundProxyEnabled === true))}
            disabled={loading || proxyLoading}
          />
        </div>
        {settings.outboundProxyEnabled === true && (
          <form onSubmit={updateOutboundProxy} className="flex flex-col gap-4 pt-2 border-t border-border/50">
            <div className="flex flex-col gap-2">
              <label htmlFor="proxy-url" className="font-medium text-sm sm:text-base">Proxy URL</label>
              <Input id="proxy-url" placeholder="http://127.0.0.1:7897"
                value={proxyForm.outboundProxyUrl}
                onChange={(e) => mergeNested("proxyForm", { outboundProxyUrl: e.target.value })}
                disabled={loading || proxyLoading}
              />
              <p className="text-xs sm:text-sm text-text-muted">Leave empty to inherit existing env proxy (if any).</p>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <label htmlFor="no-proxy" className="font-medium text-sm sm:text-base">No Proxy</label>
              <Input id="no-proxy" placeholder="localhost,127.0.0.1"
                value={proxyForm.outboundNoProxy}
                onChange={(e) => mergeNested("proxyForm", { outboundNoProxy: e.target.value })}
                disabled={loading || proxyLoading}
              />
              <p className="text-xs sm:text-sm text-text-muted">Comma-separated hostnames/domains to bypass the proxy.</p>
            </div>
            <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button type="button" variant="secondary" loading={proxyTestLoading}
                disabled={loading || proxyLoading} onClick={testOutboundProxy} className="w-full sm:w-auto"
              >Test proxy URL</Button>
              <Button type="submit" variant="primary" loading={proxyLoading} className="w-full sm:w-auto">Apply</Button>
            </div>
          </form>
        )}
        {proxyStatus.message && (
          <p className={`text-xs sm:text-sm ${proxyStatus.type === "error" ? "text-red-500" : "text-green-500"} pt-2 border-t border-border/50`}>
            {proxyStatus.message}
          </p>
        )}
      </div>
    </Card>
  );
}

function ObservabilityCard({ observabilityEnabled, loading, updateObservabilityEnabled }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
          <span className="material-symbols-outlined text-[20px]">monitoring</span>
        </div>
        <h3 className="text-base sm:text-lg font-semibold">Observability</h3>
      </div>
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base">Enable Observability</p>
          <p className="text-xs sm:text-sm text-text-muted">Record request details for inspection in the logs view</p>
        </div>
        <Toggle checked={observabilityEnabled} onChange={updateObservabilityEnabled} disabled={loading} />
      </div>
    </Card>
  );
}

function useDatabaseOps({ state, setField, setSettings }) {
  const pendingImportRef = useRef(null);
  const importFileRef = useRef(null);

  const reloadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to reload settings:", err);
    }
  };

  const handleExportDatabase = async (password) => {
    setField("dbLoading", true);
    setField("dbStatus", { type: "", message: "" });
    try {
      const res = await fetch("/api/settings/database", {
        headers: { "x-9r-password": password },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export database");
      }

      const payload = await res.json();
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[.:]/g, "-");
      anchor.href = url;
      anchor.download = `9router-backup-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setField("dbStatus", { type: "success", message: "Database backup downloaded" });
    } catch (err) {
      setField("dbStatus", { type: "error", message: err.message || "Failed to export database" });
    } finally {
      setField("dbLoading", false);
    }
  };

  const handleImportDatabase = (event) => {
    const file = event.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = "";
    if (!file) return;
    pendingImportRef.current = file;
    setField("dbStatus", { type: "", message: "" });
    setField("dbAuth", { open: true, mode: "import", password: "" });
  };

  const runImportDatabase = async (password) => {
    const file = pendingImportRef.current;
    if (!file) return;
    setField("dbLoading", true);
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);

      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to import database");
      }

      await reloadSettings();
      setField("dbStatus", { type: "success", message: "Database imported successfully" });
    } catch (err) {
      setField("dbStatus", { type: "error", message: err.message || "Invalid backup file" });
    } finally {
      pendingImportRef.current = null;
      setField("dbLoading", false);
    }
  };

  const handleDbAuthConfirm = async () => {
    const { mode, password } = state.dbAuth;
    setField("dbAuth", { open: false, mode: "", password: "" });
    if (mode === "export") await handleExportDatabase(password);
    else if (mode === "import") await runImportDatabase(password);
  };

  return { importFileRef, handleImportDatabase, handleDbAuthConfirm };
}

function useOidc({ state, setField, mergeNested, settings, setSettings }) {
  const { oidcForm, oidcClientSecret } = state;

  const updateOidcForm = (field, value) => {
    mergeNested("oidcForm", { [field]: value });
  };

  const saveOidcSettings = async (authMode = oidcForm.authMode || "password") => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const loginLabel = oidcForm.oidcLoginLabel.trim();
    const secret = oidcClientSecret.trim();

    if (authMode !== "password" && (!issuerUrl || !clientId || !secret) && !settings.oidcConfigured) {
      setField("oidcStatus", { type: "error", message: "Issuer URL, client ID, and client secret are required to enable OIDC." });
      return;
    }

    setField("oidcLoading", true);
    setField("oidcStatus", { type: "", message: "" });
    setField("oidcTestStatus", { type: "", message: "" });

    try {
      const payload = {
        authMode,
        oidcIssuerUrl: issuerUrl,
        oidcClientId: clientId,
        oidcScopes: scopes || "openid profile email",
        oidcLoginLabel: loginLabel || "Sign in with OIDC",
      };
      if (secret) {
        payload.oidcClientSecret = secret;
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setField("oidcForm", {
          authMode: data?.authMode || authMode,
          oidcIssuerUrl: data?.oidcIssuerUrl || issuerUrl,
          oidcClientId: data?.oidcClientId || clientId,
          oidcScopes: data?.oidcScopes || scopes || "openid profile email",
          oidcLoginLabel: data?.oidcLoginLabel || loginLabel || "Sign in with OIDC",
        });
        setField("oidcClientSecret", "");
        setField("oidcStatus", {
          type: "success",
          message:
            authMode === "oidc"
              ? "OIDC login enabled"
              : authMode === "both"
                ? "Password and OIDC login enabled"
                : "OIDC settings saved",
        });
      } else {
        setField("oidcStatus", { type: "error", message: data.error || "Failed to save OIDC settings" });
      }
    } catch (err) {
      setField("oidcStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("oidcLoading", false);
    }
  };

  const testOidcConnection = async () => {
    const issuerUrl = oidcForm.oidcIssuerUrl.trim();
    const clientId = oidcForm.oidcClientId.trim();
    const scopes = oidcForm.oidcScopes.trim();
    const secret = oidcClientSecret.trim();

    if (!issuerUrl || !clientId) {
      setField("oidcTestStatus", { type: "error", message: "Issuer URL and client ID are required to test the connection." });
      return;
    }

    setField("oidcTestLoading", true);
    setField("oidcStatus", { type: "", message: "" });
    setField("oidcTestStatus", { type: "", message: "" });

    try {
      const saveRes = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authMode: oidcForm.authMode || settings.authMode || "password",
          oidcIssuerUrl: issuerUrl,
          oidcClientId: clientId,
          oidcScopes: scopes || "openid profile email",
          oidcLoginLabel: oidcForm.oidcLoginLabel.trim() || "Sign in with OIDC",
          ...(secret ? { oidcClientSecret: secret } : {}),
        }),
      });

      const saved = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setField("oidcTestStatus", {
          type: "error",
          message: saved.error || "Failed to save OIDC settings before testing",
        });
        return;
      }

      const res = await fetch("/api/auth/oidc/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerUrl: saved.oidcIssuerUrl || issuerUrl,
          clientId: saved.oidcClientId || clientId,
          scopes: saved.oidcScopes || scopes || "openid profile email",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        const statusMessage = data.clientSecretTested
          ? data.clientSecretValid === true
            ? `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret validated too.`
            : `Connection OK. Discovery loaded from ${data.issuerUrl}. Client secret was not checked.`
          : `Connection OK. Discovery loaded from ${data.issuerUrl}.`;
        setField("oidcTestStatus", {
          type: "success",
          message: statusMessage,
        });
      } else {
        setField("oidcTestStatus", { type: "error", message: data.error || "OIDC connection test failed" });
      }
    } catch (err) {
      setField("oidcTestStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("oidcTestLoading", false);
    }
  };

  return { updateOidcForm, saveOidcSettings, testOidcConnection };
}

export default function ProfileClient({ initialSettings }) {
  const { theme, setTheme, isDark } = useTheme();
  const [settings, setSettings] = useState(initialSettings);

  const [state, dispatch] = useReducer(profileReducer, {
    locale: "en",
    langOpen: false,
    shutdownOpen: false,
    isShuttingDown: false,
    loading: false,
    passwords: { current: "", new: "", confirm: "" },
    passStatus: { type: "", message: "" },
    passLoading: false,
    dbLoading: false,
    dbStatus: { type: "", message: "" },
    dbAuth: { open: false, mode: "", password: "" },
    oidcForm: {
      authMode: initialSettings?.authMode || "password",
      oidcIssuerUrl: initialSettings?.oidcIssuerUrl || "",
      oidcClientId: initialSettings?.oidcClientId || "",
      oidcScopes: initialSettings?.oidcScopes || "openid profile email",
      oidcLoginLabel: initialSettings?.oidcLoginLabel || "Sign in with OIDC",
    },
    oidcClientSecret: "",
    oidcStatus: { type: "", message: "" },
    oidcLoading: false,
    oidcTestLoading: false,
    oidcTestStatus: { type: "", message: "" },
    oidcRedirectUri: "/api/auth/oidc/callback",
    oidcExpanded: initialSettings?.authMode === "oidc" || initialSettings?.authMode === "both",
    proxyForm: {
      outboundProxyEnabled: initialSettings?.outboundProxyEnabled === true,
      outboundProxyUrl: initialSettings?.outboundProxyUrl || "",
      outboundNoProxy: initialSettings?.outboundNoProxy || "",
    },
    proxyStatus: { type: "", message: "" },
    proxyLoading: false,
    proxyTestLoading: false,
  });

  const {
    locale, langOpen, shutdownOpen, isShuttingDown, loading,
    passwords, passStatus, passLoading,
    dbLoading, dbStatus, dbAuth,
    oidcForm, oidcClientSecret, oidcStatus, oidcLoading,
    oidcTestLoading, oidcTestStatus, oidcRedirectUri, oidcExpanded,
    proxyForm, proxyStatus, proxyLoading, proxyTestLoading,
  } = state;

  const setField = (field, value) => dispatch({ type: "SET_FIELD", field, value });
  const mergeNested = (field, patch) => dispatch({ type: "MERGE_NESTED", field, patch });

  const { importFileRef, handleImportDatabase, handleDbAuthConfirm } = useDatabaseOps({ state, setField, setSettings });
  const { updateOidcForm, saveOidcSettings, testOidcConnection } = useOidc({ state, setField, mergeNested, settings, setSettings });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setField("oidcRedirectUri", `${window.location.origin}/api/auth/oidc/callback`);
    }
  }, []);

  const updateOutboundProxy = async (e) => {
    e.preventDefault();
    if (settings.outboundProxyEnabled !== true) return;
    setField("proxyLoading", true);
    setField("proxyStatus", { type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outboundProxyUrl: proxyForm.outboundProxyUrl,
          outboundNoProxy: proxyForm.outboundNoProxy,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        setField("proxyStatus", { type: "success", message: "Proxy settings applied" });
      } else {
        setField("proxyStatus", { type: "error", message: data.error || "Failed to update proxy settings" });
      }
    } catch (err) {
      setField("proxyStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("proxyLoading", false);
    }
  };

  const testOutboundProxy = async () => {
    if (settings.outboundProxyEnabled !== true) return;

    const proxyUrl = (proxyForm.outboundProxyUrl || "").trim();
    if (!proxyUrl) {
      setField("proxyStatus", { type: "error", message: "Please enter a Proxy URL to test" });
      return;
    }

    setField("proxyTestLoading", true);
    setField("proxyStatus", { type: "", message: "" });

    try {
      const res = await fetch("/api/settings/proxy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxyUrl }),
      });

      const data = await res.json();
      if (res.ok && data?.ok) {
        setField("proxyStatus", {
          type: "success",
          message: `Proxy test OK (${data.status}) in ${data.elapsedMs}ms`,
        });
      } else {
        setField("proxyStatus", {
          type: "error",
          message: data?.error || "Proxy test failed",
        });
      }
    } catch (err) {
      setField("proxyStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("proxyTestLoading", false);
    }
  };

  const updateOutboundProxyEnabled = async (outboundProxyEnabled) => {
    setField("proxyLoading", true);
    setField("proxyStatus", { type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboundProxyEnabled }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({ ...prev, ...data }));
        mergeNested("proxyForm", { outboundProxyEnabled: data?.outboundProxyEnabled === true });
        setField("proxyStatus", {
          type: "success",
          message: outboundProxyEnabled ? "Proxy enabled" : "Proxy disabled",
        });
      } else {
        setField("proxyStatus", { type: "error", message: data.error || "Failed to update proxy settings" });
      }
    } catch (err) {
      setField("proxyStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("proxyLoading", false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setField("passStatus", { type: "error", message: "Passwords do not match" });
      return;
    }

    setField("passLoading", true);
    setField("passStatus", { type: "", message: "" });

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setField("passStatus", { type: "success", message: "Password updated successfully" });
        setField("passwords", { current: "", new: "", confirm: "" });
      } else {
        setField("passStatus", { type: "error", message: data.error || "Failed to update password" });
      }
    } catch (err) {
      setField("passStatus", { type: "error", message: "An error occurred" });
    } finally {
      setField("passLoading", false);
    }
  };

  const updateFallbackStrategy = (strategy) => patchSettingField(setSettings, "fallbackStrategy", strategy).catch(console.error);
  const updateComboStrategy = (strategy) => patchSettingField(setSettings, "comboStrategy", strategy).catch(console.error);
  const updateStickyLimit = (limit) => { const n = parseInt(limit); if (!isNaN(n) && n >= 1) patchSettingField(setSettings, "stickyRoundRobinLimit", n).catch(console.error); };
  const updateComboStickyLimit = (limit) => { const n = parseInt(limit); if (!isNaN(n) && n >= 1) patchSettingField(setSettings, "comboStickyRoundRobinLimit", n).catch(console.error); };
  const updateRequireLogin = (requireLogin) => patchSettingField(setSettings, "requireLogin", requireLogin).catch(console.error);
  const updateObservabilityEnabled = (enabled) => patchSettingField(setSettings, "enableObservability", enabled).catch(console.error);

  const handleShutdown = async () => {
    setField("isShuttingDown", true);
    try {
      await fetch("/api/version/shutdown", { method: "POST" });
    } catch (e) {
      // Expected to fail as server shuts down; ignore error
    }
    setField("isShuttingDown", false);
    setField("shutdownOpen", false);
  };

  const observabilityEnabled = settings.enableObservability === true;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="flex flex-col gap-6">
        <LocalModeCard
          theme={theme} setTheme={setTheme}
          dbLoading={dbLoading} dbStatus={dbStatus}
          importFileRef={importFileRef} handleImportDatabase={handleImportDatabase}
          setField={setField}
        />
        <LanguageCard locale={locale} setField={setField} />
        <SecurityCard
          settings={settings} loading={loading}
          passwords={passwords} passStatus={passStatus} passLoading={passLoading}
          updateRequireLogin={updateRequireLogin} handlePasswordChange={handlePasswordChange}
          mergeNested={mergeNested}
        />
        <OidcCard
          settings={settings} loading={loading}
          oidcForm={oidcForm} oidcClientSecret={oidcClientSecret}
          oidcStatus={oidcStatus} oidcLoading={oidcLoading}
          oidcTestLoading={oidcTestLoading} oidcTestStatus={oidcTestStatus}
          oidcRedirectUri={oidcRedirectUri} oidcExpanded={oidcExpanded}
          updateOidcForm={updateOidcForm} saveOidcSettings={saveOidcSettings}
          testOidcConnection={testOidcConnection} setField={setField}
        />
        <RoutingCard settings={settings} loading={loading}
          updateFallbackStrategy={updateFallbackStrategy} updateComboStrategy={updateComboStrategy}
          updateStickyLimit={updateStickyLimit} updateComboStickyLimit={updateComboStickyLimit}
        />
        <NetworkCard
          settings={settings} loading={loading}
          proxyForm={proxyForm} proxyStatus={proxyStatus}
          proxyLoading={proxyLoading} proxyTestLoading={proxyTestLoading}
          updateOutboundProxy={updateOutboundProxy} testOutboundProxy={testOutboundProxy}
          updateOutboundProxyEnabled={updateOutboundProxyEnabled} mergeNested={mergeNested}
        />
        <ObservabilityCard observabilityEnabled={observabilityEnabled} loading={loading}
          updateObservabilityEnabled={updateObservabilityEnabled}
        />

        <AccountFooter
          onShutdown={() => setField("shutdownOpen", true)}
          onLogout={handleLogout}
        />
      </div>

      <ProfileModals
        langOpen={langOpen} setField={setField} locale={locale}
        shutdownOpen={shutdownOpen} handleShutdown={handleShutdown} isShuttingDown={isShuttingDown}
        dbAuth={dbAuth} mergeNested={mergeNested} handleDbAuthConfirm={handleDbAuthConfirm} dbLoading={dbLoading}
      />
    </div>
  );
}
