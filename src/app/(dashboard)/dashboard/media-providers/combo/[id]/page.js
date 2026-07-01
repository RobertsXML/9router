"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import { useEffect, useReducer, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, Button, Input, Toggle, ModelSelectModal } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { AI_PROVIDERS, MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";

// Parse "providerId/model" or just "providerId" → { providerId, model }
function parseModelEntry(entry) {
  if (typeof entry !== "string") return { providerId: "", model: "" };
  const idx = entry.indexOf("/");
  if (idx < 0) return { providerId: entry, model: "" };
  return { providerId: entry.slice(0, idx), model: entry.slice(idx + 1) };
}

const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Mask large b64_json strings to keep JSON view readable
function maskB64(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(maskB64);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = (k === "b64_json" && typeof v === "string" && v.length > 100)
      ? `<${v.length} chars base64>`
      : maskB64(v);
  }
  return out;
}

const KIND_LABELS = {
  webSearch: "Web Search",
  webFetch: "Web Fetch",
  image: "Text to Image",
  tts: "Text To Speech",
};

const EXAMPLE_PATHS = {
  webSearch: "/v1/search",
  webFetch: "/v1/web/fetch",
  image: "/v1/images/generations",
  tts: "/v1/audio/speech",
};

const EXAMPLE_BODIES = {
  webSearch: (n) => ({ model: n, query: "What is the latest news about AI?", search_type: "web", max_results: 5 }),
  webFetch: (n) => ({ model: n, url: "https://example.com", format: "markdown" }),
  image: (n) => ({ model: n, prompt: "A cute cat playing piano", n: 1, size: "1024x1024" }),
  tts: (n) => ({ model: n, input: "Hello, this is a test.", voice: "alloy" }),
};

// Map combo.kind → listing route to go back to
function getListingHref(kind) {
  if (kind === "webSearch" || kind === "webFetch") return "/dashboard/media-providers/web";
  return `/dashboard/media-providers/${kind}`;
}

const initialState = {
  combo: null,
  loading: true,
  name: "",
  nameError: "",
  providers: [],
  roundRobin: false,
  showPicker: false,
  logs: [],
  testing: false,
  testResult: null,
  testError: "",
  apiKey: "",
  connections: [],
  modelAliases: {},
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_COMBO_DATA":
      return { ...state, combo: action.combo, name: action.combo.name, providers: action.combo.models || [], loading: false };
    case "SET_NOT_FOUND":
      return { ...state, combo: null, loading: false };
    case "SET_NAME":
      return { ...state, name: action.name, nameError: action.nameError ?? state.nameError };
    case "SET_PROVIDERS":
      return { ...state, providers: action.providers };
    case "SET_ROUND_ROBIN":
      return { ...state, roundRobin: action.roundRobin };
    case "SET_SHOW_PICKER":
      return { ...state, showPicker: action.showPicker };
    case "SET_TEST_STATE":
      return { ...state, testing: action.testing ?? state.testing, testResult: action.testResult ?? state.testResult, testError: action.testError ?? state.testError };
    case "SET_AUX_DATA":
      return { ...state, apiKey: action.apiKey ?? state.apiKey, connections: action.connections ?? state.connections, modelAliases: action.modelAliases ?? state.modelAliases, logs: action.logs ?? state.logs };
    default:
      return state;
  }
}

// ── Sub-components ──────────────────────────────────────────────

function ComboHeader({ combo, kindLabel, backHref, onDelete }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Link href={backHref} className="text-text-muted hover:text-primary">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">layers</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted">{kindLabel} Combo</p>
          <code className="text-lg font-semibold font-mono">{combo.name}</code>
        </div>
      </div>
      <Button variant="outline" icon="delete" onClick={onDelete} className="text-red-500 border-red-200 hover:bg-red-50">
        Delete
      </Button>
    </div>
  );
}

function ComboSettingsCard({ name, nameError, setName, validateName, onSaveName, roundRobin, onToggleRoundRobin }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-3">Settings</h2>
      <div className="flex flex-col gap-4">
        <div>
          <Input label="Combo Name" value={name} onChange={(e) => { setName(e.target.value); validateName(e.target.value); }} onBlur={onSaveName} error={nameError} />
          <p className="text-[10px] text-text-muted mt-0.5">Only letters, numbers, -, _ and .</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Round Robin</p>
            <p className="text-xs text-text-muted">Rotate providers across requests instead of strict fallback order.</p>
          </div>
          <Toggle checked={roundRobin} onChange={onToggleRoundRobin} />
        </div>
      </div>
    </Card>
  );
}

function ComboProvidersCard({ providers, onMove, onRemove, onOpenPicker }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Providers</h2>
          <p className="text-xs text-text-muted">Tried in order (top-down) or rotated when round-robin is on.</p>
        </div>
        <Button size="sm" icon="add" onClick={onOpenPicker}>Add Provider</Button>
      </div>
      {providers.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg text-text-muted text-sm">
          No providers yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {providers.map((entry, idx) => {
            const { providerId, model } = parseModelEntry(entry);
            const p = AI_PROVIDERS[providerId];
            return (
              <div key={`${entry}-${providerId}-${model || idx}`} className="flex items-center gap-3 p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
                <span className="text-xs text-text-muted w-5 text-center">{idx + 1}</span>
                <ProviderIcon
                  src={`/providers/${providerId}.png`}
                  alt={p?.name || providerId}
                  size={24}
                  className="object-contain rounded shrink-0"
                  fallbackText={p?.textIcon || providerId.slice(0, 2).toUpperCase()}
                  fallbackColor={p?.color}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p?.name || providerId}</div>
                  {model && <code className="text-[10px] text-text-muted font-mono truncate block">{model}</code>}
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => onMove(idx, -1)} disabled={idx === 0} className={`p-1 rounded ${idx === 0 ? "text-text-muted/20" : "text-text-muted hover:text-primary hover:bg-black/5"}`} title="Move up">
                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                  </button>
                  <button type="button" onClick={() => onMove(idx, 1)} disabled={idx === providers.length - 1} className={`p-1 rounded ${idx === providers.length - 1 ? "text-text-muted/20" : "text-text-muted hover:text-primary hover:bg-black/5"}`} title="Move down">
                    <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                  </button>
                  <button type="button" onClick={() => onRemove(idx)} className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10" title="Remove">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ComboTestCard({ combo, examplePath, curlExample, onTest, testing, testError, testResult, hasProviders }) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <h2 className="text-lg font-semibold">Test Example</h2>
        <Button size="sm" icon="play_arrow" onClick={onTest} disabled={testing || !hasProviders}>
          {testing ? "Running..." : "Run"}
        </Button>
      </div>
      <pre className="text-xs font-mono bg-black/[0.03] dark:bg-white/[0.03] p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
        {curlExample}
      </pre>
      {testError && (
        <p className="mt-3 text-xs text-red-500 break-words">{testError}</p>
      )}
      {testResult && (
        <div className="mt-3 flex flex-col gap-3">
          {testResult.latencyMs != null && (
            <span className="text-[11px] text-text-muted">⚡ {testResult.latencyMs}ms</span>
          )}
          {testResult.imageUrl && (
            <div>
              <div className="flex items-center justify-end mb-1.5">
                <a href={testResult.imageUrl} download="image.png" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Download
                </a>
              </div>
              <Image src={testResult.imageUrl} alt="Generated" width={1024} height={1024} unoptimized className="max-w-full rounded-lg border border-border" />
            </div>
          )}
          {testResult.audioUrl && (
            <div>
              <div className="flex items-center justify-end mb-1.5">
                <a href={testResult.audioUrl} download="speech.mp3" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Download
                </a>
              </div>
              <audio controls src={testResult.audioUrl} className="w-full" aria-label="Audio playback">
                <track kind="captions" />
              </audio>
            </div>
          )}
          {testResult.json && (
            <pre className="text-xs font-mono bg-black/[0.03] dark:bg-white/[0.03] p-3 rounded-lg overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
              {testResult.json}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}

function ComboUsageLogsCard({ logs }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-3">Usage Logs</h2>
      {logs.length === 0 ? (
        <p className="text-xs text-text-muted italic">No usage yet.</p>
      ) : (
        <pre className="text-[11px] font-mono bg-black/[0.03] dark:bg-white/[0.03] p-3 rounded-lg overflow-auto max-h-[400px] whitespace-pre-wrap">
          {logs.join("\n")}
        </pre>
      )}
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function ComboDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchAll = useCallback(async () => {
    try {
      const [comboRes, settingsRes, logsRes, keysRes, connsRes, aliasesRes] = await Promise.all([
        fetch(`/api/combos/${id}`, { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/usage/logs", { cache: "no-store" }),
        fetch("/api/keys", { cache: "no-store" }),
        fetch("/api/providers", { cache: "no-store" }),
        fetch("/api/models/alias", { cache: "no-store" }),
      ]);
      if (!comboRes.ok) { dispatch({ type: "SET_NOT_FOUND" }); return; }
      const aliases = aliasesRes.ok ? (await aliasesRes.json()).aliases || {} : {};
      let apiKey = "";
      if (keysRes.ok) {
        const k = await keysRes.json();
        apiKey = (k.keys || []).find((x) => x.isActive !== false)?.key || "";
      }
      const connections = connsRes.ok ? (await connsRes.json()).connections || [] : [];
      const c = await comboRes.json();
      dispatch({ type: "SET_COMBO_DATA", combo: c });
      const s = settingsRes.ok ? await settingsRes.json() : {};
      dispatch({ type: "SET_ROUND_ROBIN", roundRobin: s.comboStrategies?.[c.name]?.fallbackStrategy === "round-robin" });
      const allLogs = logsRes.ok ? await logsRes.json() : [];
      dispatch({ type: "SET_AUX_DATA", apiKey, connections, modelAliases: aliases, logs: allLogs.filter((l) => typeof l === "string" && l.includes(c.name)).slice(0, 50) });
    } catch { /* noop */ }
    dispatch({ type: "SET_AUX_DATA" }); // no-op to ensure loading=false on error paths already handled
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const validateName = (v) => {
    if (!v.trim()) { dispatch({ type: "SET_NAME", name: v, nameError: "Name is required" }); return false; }
    if (!VALID_NAME_REGEX.test(v)) { dispatch({ type: "SET_NAME", name: v, nameError: "Only letters, numbers, -, _ and ." }); return false; }
    dispatch({ type: "SET_NAME", name: v, nameError: "" });
    return true;
  };

  const saveCombo = async (patch) => {
    const res = await fetch(`/api/combos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to save"); return false; }
    return true;
  };

  const handleSaveName = async () => {
    if (!validateName(state.name)) return;
    if (state.name === state.combo.name) return;
    const ok = await saveCombo({ name: state.name });
    if (ok) await fetchAll();
  };

  const handleAddModel = async (model) => {
    const value = model?.value || model;
    if (!value || state.providers.includes(value)) return;
    const next = [...state.providers, value];
    dispatch({ type: "SET_PROVIDERS", providers: next });
    await saveCombo({ models: next });
  };

  const handleDeselectModel = async (model) => {
    const value = model?.value || model;
    if (!value || !state.providers.includes(value)) return;
    const next = state.providers.filter((p) => p !== value);
    dispatch({ type: "SET_PROVIDERS", providers: next });
    await saveCombo({ models: next });
  };

  const handleRemoveProvider = async (idx) => {
    const next = state.providers.filter((_, i) => i !== idx);
    dispatch({ type: "SET_PROVIDERS", providers: next });
    await saveCombo({ models: next });
  };

  const handleMove = async (idx, dir) => {
    const next = [...state.providers];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    dispatch({ type: "SET_PROVIDERS", providers: next });
    await saveCombo({ models: next });
  };

  const handleToggleRoundRobin = async (enabled) => {
    dispatch({ type: "SET_ROUND_ROBIN", roundRobin: enabled });
    const settingsRes = await fetch("/api/settings", { cache: "no-store" });
    const s = settingsRes.ok ? await settingsRes.json() : {};
    const updated = { ...(s.comboStrategies || {}) };
    if (enabled) updated[state.combo.name] = { fallbackStrategy: "round-robin" };
    else delete updated[state.combo.name];
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comboStrategies: updated }),
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Delete combo "${state.combo.name}"?`)) return;
    const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
    if (res.ok) router.push(getListingHref(state.combo.kind));
  };

  const handleTest = async () => {
    dispatch({ type: "SET_TEST_STATE", testing: true, testResult: null, testError: "" });
    if (state.testResult?.audioUrl) { try { URL.revokeObjectURL(state.testResult.audioUrl); } catch {} }
    if (state.testResult?.imageUrl?.startsWith("blob:")) { try { URL.revokeObjectURL(state.testResult.imageUrl); } catch {} }
    const start = Date.now();
    try {
      const path = EXAMPLE_PATHS[state.combo.kind];
      const body = EXAMPLE_BODIES[state.combo.kind](state.combo.name);
      const headers = { "Content-Type": "application/json" };
      if (state.apiKey) headers["Authorization"] = `Bearer ${state.apiKey}`;
      const res = await fetch(`/api${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        dispatch({ type: "SET_TEST_STATE", testing: false, testError: d?.error?.message || d?.error || `HTTP ${res.status}`, testResult: { json: JSON.stringify(d, null, 2), latencyMs } });
        return;
      }
      const ctype = res.headers.get("content-type") || "";
      if (ctype.startsWith("image/")) {
        const blob = await res.blob();
        dispatch({ type: "SET_TEST_STATE", testing: false, testResult: { imageUrl: URL.createObjectURL(blob), latencyMs } });
        return;
      }
      if (ctype.startsWith("audio/") || ctype === "application/octet-stream") {
        const blob = await res.blob();
        dispatch({ type: "SET_TEST_STATE", testing: false, testResult: { audioUrl: URL.createObjectURL(blob), latencyMs } });
        return;
      }
      const data = await res.json();
      const first = data?.data?.[0];
      const imageUrl = first?.b64_json
        ? `data:image/png;base64,${first.b64_json}`
        : (first?.url || "");
      dispatch({ type: "SET_TEST_STATE", testing: false, testResult: { json: JSON.stringify(maskB64(data), null, 2), imageUrl, latencyMs } });
    } catch (e) {
      dispatch({ type: "SET_TEST_STATE", testing: false, testError: e.message || "Network error" });
    }
  };

  if (state.loading) return <div className="text-text-muted text-sm">Loading...</div>;
  if (!state.combo) return notFound();

  const kindLabel = KIND_LABELS[state.combo.kind] || MEDIA_PROVIDER_KINDS.find((k) => k.id === state.combo.kind)?.label || "Combo";
  const examplePath = EXAMPLE_PATHS[state.combo.kind];
  const exampleBody = state.combo.kind && EXAMPLE_BODIES[state.combo.kind] ? EXAMPLE_BODIES[state.combo.kind](state.combo.name) : null;
  const curlExample = examplePath
    ? `curl -X POST http://localhost:20128${examplePath} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${state.apiKey || "YOUR_KEY"}" \\\n  -d '${JSON.stringify(exampleBody)}'`
    : "";
  const backHref = getListingHref(state.combo.kind);

  return (
    <div className="flex flex-col gap-6">
      <ComboHeader combo={state.combo} kindLabel={kindLabel} backHref={backHref} onDelete={handleDelete} />

      <ComboSettingsCard
        name={state.name}
        nameError={state.nameError}
        setName={(name) => dispatch({ type: "SET_NAME", name })}
        validateName={validateName}
        onSaveName={handleSaveName}
        roundRobin={state.roundRobin}
        onToggleRoundRobin={handleToggleRoundRobin}
      />

      <ComboProvidersCard
        providers={state.providers}
        onMove={handleMove}
        onRemove={handleRemoveProvider}
        onOpenPicker={() => dispatch({ type: "SET_SHOW_PICKER", showPicker: true })}
      />

      {state.combo.kind && examplePath && (
        <ComboTestCard
          combo={state.combo}
          examplePath={examplePath}
          curlExample={curlExample}
          onTest={handleTest}
          testing={state.testing}
          testError={state.testError}
          testResult={state.testResult}
          hasProviders={state.providers.length > 0}
        />
      )}

      <ComboUsageLogsCard logs={state.logs} />

      <ModelSelectModal
        isOpen={state.showPicker}
        onClose={() => dispatch({ type: "SET_SHOW_PICKER", showPicker: false })}
        onSelect={handleAddModel}
        onDeselect={handleDeselectModel}
        activeProviders={state.connections}
        modelAliases={state.modelAliases}
        title={`Add ${kindLabel} Model`}
        kindFilter={state.combo.kind}
        addedModelValues={state.providers}
        closeOnSelect={false}
      />
    </div>
  );
}
