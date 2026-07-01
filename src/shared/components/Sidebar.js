"use client";

import { useEffect, useReducer } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";
import NineRemotePromoModal from "./NineRemotePromoModal";

// const VISIBLE_MEDIA_KINDS = ["embedding", "image", "imageToText", "tts", "stt", "webSearch", "webFetch", "video", "music"];
const VISIBLE_MEDIA_KINDS = ["embedding", "image", "tts", "stt"];
// Combined entry: webSearch + webFetch share one page at /dashboard/media-providers/web
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

const navItems = [
  { href: "/dashboard/endpoint", label: "Endpoint & Key", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  // { href: "/dashboard/basic-chat", label: "Basic Chat", icon: "chat" }, // Hidden
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota Tracker", icon: "data_usage" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
];

const debugItems = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
];

const initialUpdateState = {
  updateInfo: null,
  showUpdateModal: false,
  isUpdating: false,
  shutdownCountdown: 0,
  isDisconnected: false,
};

function updateReducer(state, action) {
  switch (action.type) {
    case "UPDATE_FOUND":
      return { ...state, updateInfo: action.payload };
    case "SHOW_UPDATE_MODAL":
      return { ...state, showUpdateModal: action.payload };
    case "START_UPDATING":
      return { ...state, showUpdateModal: false, isUpdating: true };
    case "SET_COUNTDOWN":
      return { ...state, shutdownCountdown: action.payload };
    case "CANCEL_UPDATE":
      return { ...state, isUpdating: false, shutdownCountdown: 0 };
    case "SET_DISCONNECTED":
      return { ...state, isDisconnected: true };
    default:
      return state;
  }
}

const initialSidebarState = {
  mediaOpen: false,
  showRemoteModal: false,
  enableTranslator: false,
};

function sidebarReducer(state, action) {
  switch (action.type) {
    case "TOGGLE_MEDIA":
      return { ...state, mediaOpen: !state.mediaOpen };
    case "SET_SHOW_REMOTE_MODAL":
      return { ...state, showRemoteModal: action.payload };
    case "SET_ENABLE_TRANSLATOR":
      return { ...state, enableTranslator: action.payload };
    default:
      return state;
  }
}

function UpdateBanner({ updateInfo, copied, installCmd, onCopy, onShowUpdateModal }) {
  if (!updateInfo) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded p-1 -m-1">
      <span className="text-xs font-semibold text-green-600 dark:text-amber-500">
        ↑ New version available: v{updateInfo.latestVersion}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShowUpdateModal}
          className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors cursor-pointer"
        >
          Update now
        </button>
        <button
          type="button"
          onClick={onCopy}
          title="Copy install command"
          className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer min-w-0"
        >
          <code className="block text-[10px] text-green-600/80 dark:text-amber-400/70 font-mono truncate">
            {copied ? "✓ copied!" : installCmd}
          </code>
        </button>
      </div>
    </div>
  );
}

function SystemNavSection({ pathname, onClose, isActive, mediaOpen, onToggleMedia, enableTranslator, onShowRemote }) {
  return (
    <div className="pt-3 mt-2 space-y-0.5">
      <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
        System
      </p>

      {/* Media Providers accordion */}
      <button
        type="button"
        onClick={onToggleMedia}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
          pathname.startsWith("/dashboard/media-providers")
            ? "bg-primary/10 text-primary"
            : "text-text-muted hover:bg-surface-2 hover:text-text-main"
        )}
      >
        <span className="material-symbols-outlined text-[18px]">perm_media</span>
        <span className="text-[13px] font-medium flex-1 text-left">Media Providers</span>
        <span className="material-symbols-outlined text-[14px] transition-transform" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          expand_more
        </span>
      </button>
      {mediaOpen && (
        <div className="pl-4">
          {MEDIA_PROVIDER_KINDS.flatMap((kind) => VISIBLE_MEDIA_KINDS.includes(kind.id) ? [
            <Link
              key={kind.id}
              href={`/dashboard/media-providers/${kind.id}`}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-4 py-1 rounded-lg transition-all group",
                pathname.startsWith(`/dashboard/media-providers/${kind.id}`)
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <span className="material-symbols-outlined text-[16px]">{kind.icon}</span>
              <span className="text-sm">{kind.label}</span>
            </Link>
          ] : [])}
          <Link
            key={COMBINED_WEB_ITEM.id}
            href={COMBINED_WEB_ITEM.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-4 py-1 rounded-lg transition-all group",
              pathname.startsWith(COMBINED_WEB_ITEM.href)
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-surface-2 hover:text-text-main"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">{COMBINED_WEB_ITEM.icon}</span>
            <span className="text-sm">{COMBINED_WEB_ITEM.label}</span>
          </Link>
        </div>
      )}

      {systemItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
            isActive(item.href)
              ? "bg-primary/10 text-primary"
              : "text-text-muted hover:bg-surface-2 hover:text-text-main"
          )}
        >
          <span
            className={cn(
              "material-symbols-outlined text-[18px]",
              isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
            )}
          >
            {item.icon}
          </span>
          <span className="text-[13px] font-medium">{item.label}</span>
        </Link>
      ))}

      {/* Debug items (inside System section, before Settings) */}
      {debugItems.map((item) => {
        const show = item.href !== "/dashboard/translator" || enableTranslator;
        return show ? (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-surface-2 hover:text-text-main"
            )}
          >
            <span
              className={cn(
                "material-symbols-outlined text-[18px]",
                isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
              )}
            >
              {item.icon}
            </span>
            <span className="text-[13px] font-medium">{item.label}</span>
          </Link>
        ) : null;
      })}

      {/* Remote */}
      <button
        type="button"
        onClick={onShowRemote}
        className={cn(
          "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group w-full",
          "text-text-muted hover:bg-surface-2 hover:text-text-main"
        )}
      >
        <span className="material-symbols-outlined text-[18px] group-hover:text-primary transition-colors">
          computer
        </span>
        <span className="text-[13px] font-medium">Remote</span>
      </button>

      {/* Settings */}
      <Link
        href="/dashboard/profile"
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
          isActive("/dashboard/profile")
            ? "bg-primary/10 text-primary"
            : "text-text-muted hover:bg-surface-2 hover:text-text-main"
        )}
      >
        <span
          className={cn(
            "material-symbols-outlined text-[18px]",
            isActive("/dashboard/profile") ? "fill-1" : "group-hover:text-primary transition-colors"
          )}
        >
          settings
        </span>
        <span className="text-[13px] font-medium">Settings</span>
      </Link>
    </div>
  );
}

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [update, dispatch] = useReducer(updateReducer, initialUpdateState);
  const [{ mediaOpen, showRemoteModal, enableTranslator }, dispatchSidebar] = useReducer(sidebarReducer, initialSidebarState);
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings", { signal: controller.signal })
      .then(res => res.json())
      .then(data => { if (data.enableTranslator) dispatchSidebar({ type: "SET_ENABLE_TRANSLATOR", payload: true }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, []);

  // Lazy check for new npm version on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/version", { signal: controller.signal })
      .then(res => res.json())
      .then(data => { if (data.hasUpdate) dispatch({ type: "UPDATE_FOUND", payload: data }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, []);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  // Open manual update panel (no countdown yet — user must click Copy to trigger shutdown)
  const handleUpdate = () => {
    dispatch({ type: "START_UPDATING" });
  };

  // Triggered by Copy button inside ManualUpdatePanel: copy + countdown + shutdown
  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch { /* clipboard blocked */ }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    dispatch({ type: "SET_COUNTDOWN", payload: remaining });
    const timer = setInterval(() => {
      remaining -= 1;
      dispatch({ type: "SET_COUNTDOWN", payload: remaining });
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        dispatch({ type: "SET_DISCONNECTED" });
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    dispatch({ type: "CANCEL_UPDATE" });
  };

  // Note: legacy updater poll removed. New flow: copy install cmd + shutdown server,
  // user runs the command manually in another terminal.


  return (
    <>
      <aside className="flex w-72 flex-col border-r border-border-subtle bg-vibrancy backdrop-blur-xl transition-colors duration-300 min-h-full">
        {/* Traffic lights */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
        </div>

        {/* Logo */}
        <div className="px-6 py-4 flex flex-col gap-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--shadow-warm)]">
              <span className="material-symbols-outlined text-white text-[20px]">hub</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold tracking-tight text-text-main">
                {APP_CONFIG.name}
              </h1>
              <span className="text-xs text-text-muted">v{APP_CONFIG.version}</span>
            </div>
          </Link>
          <UpdateBanner
            updateInfo={update.updateInfo}
            copied={copied}
            installCmd={INSTALL_CMD}
            onCopy={() => copy(INSTALL_CMD)}
            onShowUpdateModal={() => dispatch({ type: "SHOW_UPDATE_MODAL", payload: true })}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-1 rounded-lg transition-all group",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined text-[18px]",
                  isActive(item.href) ? "fill-1" : "group-hover:text-primary transition-colors"
                )}
              >
                {item.icon}
              </span>
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          ))}

          <SystemNavSection
            pathname={pathname}
            onClose={onClose}
            isActive={isActive}
            mediaOpen={mediaOpen}
            onToggleMedia={() => dispatchSidebar({ type: "TOGGLE_MEDIA" })}
            enableTranslator={enableTranslator}
            onShowRemote={() => dispatchSidebar({ type: "SET_SHOW_REMOTE_MODAL", payload: true })}
          />
        </nav>

      </aside>

      {/* Remote Promo Modal */}
      <NineRemotePromoModal isOpen={showRemoteModal} onClose={() => dispatchSidebar({ type: "SET_SHOW_REMOTE_MODAL", payload: false })} />

      {/* Update Confirmation Modal */}
      <ConfirmModal
        isOpen={update.showUpdateModal}
        onClose={() => dispatch({ type: "SHOW_UPDATE_MODAL", payload: false })}
        onConfirm={handleUpdate}
        title="Update 9Router"
        message={`Show install command for v${update.updateInfo?.latestVersion || ""}? You can copy it and shutdown to install manually.`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Disconnected / Updating Overlay */}
      {(update.isDisconnected || update.isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {update.isUpdating ? (
            <ManualUpdatePanel
              latestVersion={update.updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={update.shutdownCountdown}
              isDisconnected={update.isDisconnected}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl bg-neutral-900/95 border border-white/10 p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-full bg-amber-500/20 text-amber-400">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Update 9Router{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-white/60">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="text-sm text-white/80 mb-2">Install command:</p>
      <div className="w-full px-3 py-2 rounded bg-white/5 mb-4">
        <code className="text-xs font-mono text-amber-400 break-all">{installCmd}</code>
      </div>

      <ol className="text-xs text-white/70 space-y-1 list-decimal list-inside mb-4">
        <li>Click <strong>Copy & Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="px-1 rounded bg-white/10 text-green-400">9router</code> again after install.</li>
      </ol>

      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
