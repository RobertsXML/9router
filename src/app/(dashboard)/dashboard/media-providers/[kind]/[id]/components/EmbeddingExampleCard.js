"use client";

import { useEffect, useReducer } from "react";
import { Card } from "@/shared/components";
import { getProviderAlias, isCustomEmbeddingProvider } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Row } from "./exampleShared";

const DEFAULT_RESPONSE_EXAMPLE = `{
  "object": "list",
  "data": [{
    "object": "embedding",
    "index": 0,
    "embedding": [0.002301, -0.019212, 0.004815, -0.031249, ...]
  }],
  "model": "...",
  "usage": { "prompt_tokens": 9, "total_tokens": 9 }
}`;

function formatResultJson(data) {
  if (!data) return DEFAULT_RESPONSE_EXAMPLE;
  const clone = structuredClone(data);
  (clone.data || []).forEach((item) => {
    if (Array.isArray(item.embedding) && item.embedding.length > 4) {
      item.embedding = [...item.embedding.slice(0, 4).map((v) => parseFloat(v.toFixed(6))), `... (${item.embedding.length} dims)`];
    }
  });
  return JSON.stringify(clone, null, 2);
}

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    default: return state;
  }
}

function connectionReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    default: return state;
  }
}

function requestReducer(state, action) {
  switch (action.type) {
    case 'SET_RUNNING': return { ...state, running: true, error: "", result: null };
    case 'SET_RESULT': return { ...state, running: false, result: action.payload };
    case 'SET_ERROR': return { ...state, running: false, error: action.payload };
    default: return state;
  }
}

export function EmbeddingExampleCard({ providerId, customAlias }) {
  const isCustom = isCustomEmbeddingProvider(providerId);
  const providerAlias = isCustom ? (customAlias || providerId) : getProviderAlias(providerId);
  const embeddingModels = isCustom ? [] : getModelsByProviderId(providerId).filter((m) => getModelKind(m) === "embedding");

  const [form, dispatchForm] = useReducer(formReducer, {
    selectedModel: embeddingModels[0]?.id ?? "",
    input: "The quick brown fox jumps over the lazy dog",
    dimensions: "",
  });
  const [connection, dispatchConnection] = useReducer(connectionReducer, {
    apiKey: "",
    useTunnel: false,
    localEndpoint: window.location.origin,
    tunnelEndpoint: "",
  });
  const [{ result, running, error }, dispatchRequest] = useReducer(requestReducer, { result: null, running: false, error: "" });
  const { copied: copiedCurl, copy: copyCurl } = useCopyToClipboard();
  const { copied: copiedRes, copy: copyRes } = useCopyToClipboard();

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/keys", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { dispatchConnection({ type: 'SET_FIELD', field: 'apiKey', value: (d.keys || []).find((k) => k.isActive !== false)?.key || "" }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    fetch("/api/tunnel/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { if (d.publicUrl) dispatchConnection({ type: 'SET_FIELD', field: 'tunnelEndpoint', value: d.publicUrl }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, []);

  const endpoint = connection.useTunnel ? connection.tunnelEndpoint : connection.localEndpoint;
  const modelFull = form.selectedModel ? `${providerAlias}/${form.selectedModel}` : "";

  // Build request body — include dimensions only if user provided a positive number
  const buildBody = () => {
    const body = { model: modelFull, input: form.input.trim() };
    const dim = Number(form.dimensions);
    if (form.dimensions && Number.isFinite(dim) && dim > 0) body.dimensions = dim;
    return body;
  };

  const curlSnippet = `curl -X POST ${endpoint}/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${connection.apiKey || "YOUR_KEY"}" \\
  -d '${JSON.stringify(buildBody())}'`;

  const handleRun = async () => {
    if (!form.input.trim() || !modelFull) return;
    dispatchRequest({ type: 'SET_RUNNING' });
    const start = Date.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (connection.apiKey) headers["Authorization"] = `Bearer ${connection.apiKey}`;
      const res = await fetch("/api/v1/embeddings", {
        method: "POST",
        headers,
        body: JSON.stringify(buildBody()),
      });
      const latencyMs = Date.now() - start;
      const data = await res.json();
      if (!res.ok) { dispatchRequest({ type: 'SET_ERROR', payload: data?.error?.message || data?.error || `HTTP ${res.status}` }); return; }
      dispatchRequest({ type: 'SET_RESULT', payload: { data, latencyMs } });
    } catch (e) {
      dispatchRequest({ type: 'SET_ERROR', payload: e.message || "Network error" });
    }
  };

  const resultJson = result ? JSON.stringify(result.data, null, 2) : "";

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">Example</h2>

      <div className="flex flex-col gap-2.5">
        {/* Model — text input for custom node, dropdown otherwise */}
        <Row label="Model">
          {isCustom ? (
            <input
              value={form.selectedModel}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'selectedModel', value: e.target.value })}
              placeholder="e.g. voyage-3, embed-english-v3.0, text-embedding-3-small"
              aria-label="Model"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
            />
          ) : (
            <select
              value={form.selectedModel}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'selectedModel', value: e.target.value })}
              aria-label="Model"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            >
              {embeddingModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.id}</option>
              ))}
            </select>
          )}
        </Row>

        {/* Endpoint */}
        <Row label="Endpoint">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              value={endpoint}
              onChange={(e) => connection.useTunnel ? dispatchConnection({ type: 'SET_FIELD', field: 'tunnelEndpoint', value: e.target.value }) : dispatchConnection({ type: 'SET_FIELD', field: 'localEndpoint', value: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
              placeholder="http://localhost:3000"
              aria-label="Endpoint"
            />
            {/* Tunnel toggle — only show if tunnel URL is available */}
            {connection.tunnelEndpoint && (
              <button
                type="button"
                onClick={() => dispatchConnection({ type: 'SET_FIELD', field: 'useTunnel', value: !connection.useTunnel })}
                title={connection.useTunnel ? "Using tunnel" : "Using local"}
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border shrink-0 transition-colors ${
                  connection.useTunnel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-text-muted hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">wifi_tethering</span>
                Tunnel
              </button>
            )}
          </div>
        </Row>

        {/* API Key */}
        <Row label="API Key">
          <input
            type="password"
            value={connection.apiKey}
            onChange={(e) => dispatchConnection({ type: 'SET_FIELD', field: 'apiKey', value: e.target.value })}
            placeholder="sk-..."
            aria-label="API Key"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
          />
        </Row>

        {/* Input */}
        <Row label="Input">
          <div className="relative">
            <input
              value={form.input}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'input', value: e.target.value })}
              aria-label="Input text"
              className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
            {form.input && (
              <button
                type="button"
                onClick={() => dispatchForm({ type: 'SET_FIELD', field: 'input', value: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </Row>

        {/* Dimensions (optional) — truncate embedding vector length */}
        <Row label="Dimensions">
          <input
            type="number"
            min="1"
            value={form.dimensions}
            onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'dimensions', value: e.target.value })}
            placeholder="optional, e.g. 512, 1024 (leave empty for default)"
            aria-label="Dimensions"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </Row>

        {/* Curl + Run */}
        <div className="mt-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Request</span>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => copyCurl(curlSnippet)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">{copiedCurl ? "check" : "content_copy"}</span>
                {copiedCurl ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleRun}
                disabled={running || !form.input.trim() || !modelFull}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[14px]" style={running ? { animation: "spin 1s linear infinite" } : undefined}>
                  play_arrow
                </span>
                {running ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all">{curlSnippet}</pre>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-500 break-words">{error}</p>}

        {/* Response — default example or real result */}
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response {result && <span className="font-normal normal-case">&#9889; {result.latencyMs}ms</span>}
            </span>
            {result && (
              <button
                type="button"
                onClick={() => copyRes(resultJson)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">{copiedRes ? "check" : "content_copy"}</span>
                {copiedRes ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all opacity-70">
            {formatResultJson(result?.data)}
          </pre>
        </div>
      </div>
    </Card>
  );
}
