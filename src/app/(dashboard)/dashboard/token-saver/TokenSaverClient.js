"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import { Card, Button, Input, Modal, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { getCurrentLocale, onLocaleChange } from "@/i18n/runtime";
import {
  WENYAN_LOCALES,
  CAVEMAN_LEVELS,
  PONYTAIL_LEVELS,
} from "../endpoint/endpointConstants";

async function patchSetting(patch) {
  try {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch (error) {
    console.log("Error updating setting:", error);
  }
}

// ── Reducer ─────────────────────────────────────────────────────

const initialState = {
  rtkEnabled: true,
  headroomEnabled: false,
  headroomUrl: "http://localhost:8787",
  headroomStatus: { installed: false, running: false, python: null, loading: true },
  showHeadroomInstallModal: false,
  headroomActionLoading: false,
  headroomActionError: "",
  cavemanEnabled: false,
  cavemanLevel: "full",
  ponytailEnabled: false,
  ponytailLevel: "full",
  locale: getCurrentLocale(),
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_RTK":
      return { ...state, rtkEnabled: action.value };
    case "SET_HEADROOM":
      return { ...state, ...action.values };
    case "SET_HEADROOM_STATUS":
      return { ...state, headroomStatus: action.status };
    case "SET_CAVEMAN":
      return { ...state, ...action.values };
    case "SET_PONYTAIL":
      return { ...state, ...action.values };
    case "SET_LOCALE":
      return { ...state, locale: action.locale };
    default:
      return state;
  }
}

// ── Sub-components ──────────────────────────────────────────────

function RtkSection({ enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-4 border-b border-border gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Compress tool output{" "}
          <a
            href="https://github.com/rtk-ai/rtk"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-normal text-primary underline hover:opacity-80"
          >
            (RTK)
          </a>
        </p>
        <p className="text-sm text-text-muted">
          git/grep/ls/tree/logs → 60-90% fewer input tokens
        </p>
      </div>
      <Toggle checked={enabled} onChange={() => onToggle(!enabled)} />
    </div>
  );
}

function HeadroomSection({ enabled, running, statusLabel, onToggle, onOpenModal }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="font-medium">
            Compress context{" "}
            <a
              href="https://github.com/chopratejas/headroom"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-normal text-primary underline hover:opacity-80"
            >
              (Headroom)
            </a>
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded ${running ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
          >
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={onOpenModal}
            className="text-xs text-primary underline hover:opacity-80"
          >
            {running ? "Manage" : "Setup"}
          </button>
        </div>
        <p className="text-sm text-text-muted mt-1">
          Compress prompts via /v1/compress before routing to the model
        </p>
      </div>
      <Toggle
        checked={enabled && running}
        disabled={!running}
        onChange={() => onToggle(!enabled)}
      />
    </div>
  );
}

function CavemanSection({ enabled, level, visibleLevels, onToggle, onSetLevel }) {
  return (
    <div className="flex items-center justify-between pt-4 gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Compress LLM output{" "}
          <a
            href="https://github.com/JuliusBrussee/caveman"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-normal text-primary underline hover:opacity-80"
          >
            (Caveman)
          </a>
        </p>
        <p className="text-sm text-text-muted">
          Terse-style system prompt → ~65% fewer output tokens (up to 87%)
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {enabled && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              {visibleLevels.map((lvl) => (
                <button
                  type="button"
                  key={lvl.id}
                  onClick={() => onSetLevel(lvl.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    level === lvl.id
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent border-border text-text-muted hover:bg-surface-2"
                  }`}
                  title={lvl.desc}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-primary">
              {CAVEMAN_LEVELS.find((lvl) => lvl.id === level)?.desc}
            </p>
          </div>
        )}
        <Toggle checked={enabled} onChange={() => onToggle(!enabled)} />
      </div>
    </div>
  );
}

function PonytailSection({ enabled, level, onToggle, onSetLevel }) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          Lazy senior dev{" "}
          <a
            href="https://github.com/DietrichGebert/ponytail"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-normal text-primary underline hover:opacity-80"
          >
            (Ponytail)
          </a>
        </p>
        <p className="text-sm text-text-muted">
          Bias the model toward minimal code: YAGNI, reuse stdlib,
          deletion over addition
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {enabled && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              {PONYTAIL_LEVELS.map((lvl) => (
                <button
                  type="button"
                  key={lvl.id}
                  onClick={() => onSetLevel(lvl.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    level === lvl.id
                      ? "bg-primary text-white border-primary"
                      : "bg-transparent border-border text-text-muted hover:bg-surface-2"
                  }`}
                  title={lvl.desc}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-primary">
              {PONYTAIL_LEVELS.find((lvl) => lvl.id === level)?.desc}
            </p>
          </div>
        )}
        <Toggle checked={enabled} onChange={() => onToggle(!enabled)} />
      </div>
    </div>
  );
}

function HeadroomInstallModal({
  isOpen,
  onClose,
  running,
  statusLabel,
  headroomUrl,
  onUrlChange,
  onUrlBlur,
  managed,
  canStart,
  localUrl,
  hasPython,
  actionLoading,
  actionError,
  onStart,
  onStop,
  onRecheck,
  copied,
  onCopy,
}) {
  return (
    <Modal
      isOpen={isOpen}
      title={running ? "Headroom" : "Setup Headroom"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm">
          <span>Status</span>
          <span className={running ? "text-success" : "text-warning"}>
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Proxy URL</p>
          <Input
            value={headroomUrl}
            onChange={onUrlChange}
            onBlur={onUrlBlur}
            placeholder="http://localhost:8787"
            className="font-mono text-sm"
          />
          <p className="text-xs text-text-muted">
            Use a local proxy for Start/Stop, or an external Docker sidecar
            like http://headroom:8787.
          </p>
        </div>
        {managed ? (
          <Button
            onClick={onStop}
            variant="ghost"
            fullWidth
            disabled={actionLoading}
          >
            {actionLoading ? "Stopping…" : "Stop Headroom"}
          </Button>
        ) : running ? (
          <p className="text-sm text-success">
            Headroom proxy is reachable. You can enable the token saver.
          </p>
        ) : canStart ? (
          <Button
            onClick={onStart}
            fullWidth
            disabled={actionLoading}
          >
            {actionLoading ? "Starting…" : "Start Headroom"}
          </Button>
        ) : !localUrl ? (
          <p className="text-sm text-warning">
            Start Headroom separately at the configured URL, then recheck.
          </p>
        ) : !hasPython ? (
          <p className="text-sm text-warning">
            Python ≥ 3.10 required for local managed mode. Install Python
            first, or use an external proxy URL.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Install then click Start:</p>
            <div className="flex items-center gap-2">
              <pre className="flex-1 rounded bg-black/5 dark:bg-white/5 p-2 text-xs font-mono overflow-x-auto">
                {`pip install "headroom-ai[proxy]"`}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onCopy(`pip install "headroom-ai[proxy]"`)}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
        {actionError && (
          <p className="text-sm text-warning">{actionError}</p>
        )}
        <div className="flex gap-2">
          <Button onClick={onRecheck} variant="ghost" fullWidth>
            Recheck
          </Button>
          <Button onClick={onClose} fullWidth>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function TokenSaverClient() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    return onLocaleChange((newLocale) => {
      dispatch({ type: "SET_LOCALE", locale: newLocale });
      if (!WENYAN_LOCALES.includes(newLocale)) {
        dispatch({ type: "SET_CAVEMAN", values: {} }); // trigger re-render
        // Check if current caveman level is wenyan-only
        const currentLevel = CAVEMAN_LEVELS.find((lvl) => lvl.id === state.cavemanLevel);
        if (currentLevel?.wenyan) {
          patchSetting({ cavemanLevel: "ultra" });
          dispatch({ type: "SET_CAVEMAN", values: { cavemanLevel: "ultra" } });
        }
      }
    });
  }, [state.cavemanLevel]);

  const isWenyanLocale = WENYAN_LOCALES.includes(state.locale);
  const visibleCavemanLevels = isWenyanLocale
    ? CAVEMAN_LEVELS
    : CAVEMAN_LEVELS.filter((lvl) => !lvl.wenyan);

  const handleRtkEnabled = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtkEnabled: value }),
      });
      if (res.ok) dispatch({ type: "SET_RTK", value });
    } catch (error) {
      console.log("Error updating rtkEnabled:", error);
    }
  };

  const handleCavemanEnabled = (value) => {
    dispatch({ type: "SET_CAVEMAN", values: { cavemanEnabled: value } });
    patchSetting({ cavemanEnabled: value });
  };

  const handleHeadroomEnabled = (value) => {
    const nextUrl = state.headroomUrl.trim() || "http://localhost:8787";
    dispatch({ type: "SET_HEADROOM", values: { headroomUrl: nextUrl, headroomEnabled: value } });
    patchSetting({ headroomEnabled: value, headroomUrl: nextUrl });
  };

  const handleHeadroomUrlBlur = async () => {
    const next = state.headroomUrl.trim() || "http://localhost:8787";
    dispatch({ type: "SET_HEADROOM", values: { headroomUrl: next } });
    await patchSetting({ headroomUrl: next });
    refreshHeadroomStatus();
  };

  const refreshHeadroomStatus = useCallback(async () => {
    dispatch({ type: "SET_HEADROOM_STATUS", status: { ...state.headroomStatus, loading: true } });
    try {
      const res = await fetch("/api/headroom/status", {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      dispatch({ type: "SET_HEADROOM_STATUS", status: { ...data, loading: false } });
    } catch {
      dispatch({ type: "SET_HEADROOM_STATUS", status: { installed: false, running: false, python: null, loading: false } });
    }
  }, [state.headroomStatus]);

  const handleHeadroomStart = useCallback(async () => {
    dispatch({ type: "SET_HEADROOM", values: { headroomActionError: "", headroomActionLoading: true } });
    try {
      const res = await fetch("/api/headroom/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to start proxy");
      await refreshHeadroomStatus();
    } catch (e) {
      dispatch({ type: "SET_HEADROOM", values: { headroomActionError: e.message } });
    } finally {
      dispatch({ type: "SET_HEADROOM", values: { headroomActionLoading: false } });
    }
  }, [refreshHeadroomStatus]);

  const handleHeadroomStop = useCallback(async () => {
    dispatch({ type: "SET_HEADROOM", values: { headroomActionLoading: true } });
    try {
      await fetch("/api/headroom/stop", { method: "POST" });
      await refreshHeadroomStatus();
    } finally {
      dispatch({ type: "SET_HEADROOM", values: { headroomActionLoading: false } });
    }
  }, [refreshHeadroomStatus]);

  const handleCavemanLevel = (level) => {
    dispatch({ type: "SET_CAVEMAN", values: { cavemanLevel: level } });
    patchSetting({ cavemanLevel: level });
  };

  const handlePonytailEnabled = (value) => {
    dispatch({ type: "SET_PONYTAIL", values: { ponytailEnabled: value } });
    patchSetting({ ponytailEnabled: value });
  };

  const handlePonytailLevel = (level) => {
    dispatch({ type: "SET_PONYTAIL", values: { ponytailLevel: level } });
    patchSetting({ ponytailLevel: level });
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings", { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          dispatch({ type: "SET_RTK", value: data.rtkEnabled !== false });
          dispatch({ type: "SET_HEADROOM", values: {
            headroomEnabled: !!data.headroomEnabled,
            headroomUrl: data.headroomUrl || "http://localhost:8787",
          }});
          dispatch({ type: "SET_CAVEMAN", values: {
            cavemanEnabled: !!data.cavemanEnabled,
            cavemanLevel: data.cavemanLevel || "full",
          }});
          dispatch({ type: "SET_PONYTAIL", values: {
            ponytailEnabled: !!data.ponytailEnabled,
            ponytailLevel: data.ponytailLevel || "full",
          }});
          refreshHeadroomStatus();
        }
      } catch {}
    };
    loadSettings();
    return () => controller.abort();
  }, [refreshHeadroomStatus]);

  const headroomRunning = !!state.headroomStatus.running;
  const headroomStatusLabel = state.headroomStatus.loading
    ? "Checking…"
    : headroomRunning
      ? "Running"
      : state.headroomStatus.localUrl !== false && !state.headroomStatus.installed
        ? "Not installed"
        : state.headroomStatus.localUrl !== false
          ? "Stopped"
          : "External";
  const headroomLocalUrl = state.headroomStatus.localUrl !== false;
  const headroomCanStart = !!state.headroomStatus.canStart;
  const headroomManaged = headroomLocalUrl && !!state.headroomStatus.managedPid;

  return (
    <div className="space-y-6 p-6">
      <Card id="rtk">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              bolt
            </span>
            Token Saver
          </h2>
        </div>
        <RtkSection enabled={state.rtkEnabled} onToggle={handleRtkEnabled} />
        <HeadroomSection
          enabled={state.headroomEnabled}
          running={headroomRunning}
          statusLabel={headroomStatusLabel}
          onToggle={handleHeadroomEnabled}
          onOpenModal={() => dispatch({ type: "SET_HEADROOM", values: { showHeadroomInstallModal: true } })}
        />
        <CavemanSection
          enabled={state.cavemanEnabled}
          level={state.cavemanLevel}
          visibleLevels={visibleCavemanLevels}
          onToggle={handleCavemanEnabled}
          onSetLevel={handleCavemanLevel}
        />
        <PonytailSection
          enabled={state.ponytailEnabled}
          level={state.ponytailLevel}
          onToggle={handlePonytailEnabled}
          onSetLevel={handlePonytailLevel}
        />
      </Card>

      <HeadroomInstallModal
        isOpen={state.showHeadroomInstallModal}
        onClose={() => dispatch({ type: "SET_HEADROOM", values: { showHeadroomInstallModal: false } })}
        running={headroomRunning}
        statusLabel={headroomStatusLabel}
        headroomUrl={state.headroomUrl}
        onUrlChange={(e) => dispatch({ type: "SET_HEADROOM", values: { headroomUrl: e.target.value } })}
        onUrlBlur={handleHeadroomUrlBlur}
        managed={headroomManaged}
        canStart={headroomCanStart}
        localUrl={headroomLocalUrl}
        hasPython={!!state.headroomStatus.python}
        actionLoading={state.headroomActionLoading}
        actionError={state.headroomActionError}
        onStart={handleHeadroomStart}
        onStop={handleHeadroomStop}
        onRecheck={() => refreshHeadroomStatus()}
        copied={copied}
        onCopy={copy}
      />
    </div>
  );
}
