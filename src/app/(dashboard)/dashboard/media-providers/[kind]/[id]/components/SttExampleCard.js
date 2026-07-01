"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { Card } from "@/shared/components";
import { getProviderAlias } from "@/shared/constants/providers";
import { getModelKind } from "@/shared/constants/models";
import { getModelsByProviderId } from "@/shared/constants/models";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Row } from "./exampleShared";

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
    case 'SET_RUNNING': return { ...state, running: true, error: "", result: null, latency: null };
    case 'SET_RESULT': return { ...state, running: false, result: action.payload.data, latency: action.payload.latency };
    case 'SET_ERROR': return { ...state, running: false, error: action.payload };
    default: return state;
  }
}

export function SttExampleCard({ providerId }) {
  const providerAlias = getProviderAlias(providerId);
  const builtinSttModels = getModelsByProviderId(providerId).filter((m) => getModelKind(m) === "stt");
  const [customSttModels, setCustomSttModels] = useState([]);
  const sttModels = [...builtinSttModels, ...customSttModels];

  const [form, dispatchForm] = useReducer(formReducer, {
    selectedModel: builtinSttModels[0]?.id ?? "",
    audioFile: null,
    language: "",
    prompt: "",
    responseFormat: "json",
    temperature: "",
  });
  const selectedModelObj = sttModels.find((m) => m.id === form.selectedModel);
  const allowedParams = Array.isArray(selectedModelObj?.params) ? selectedModelObj.params : [];

  const [connection, dispatchConnection] = useReducer(connectionReducer, {
    apiKey: "",
    useTunnel: false,
    localEndpoint: window.location.origin,
    tunnelEndpoint: "",
  });
  const [{ result, latency, running, error }, dispatchRequest] = useReducer(requestReducer, { result: null, latency: null, running: false, error: "" });
  const { copied: copiedCurl, copy: copyCurl } = useCopyToClipboard();
  const { copied: copiedRes, copy: copyRes } = useCopyToClipboard();

  const providerAliasRef = useRef(providerAlias);
  providerAliasRef.current = providerAlias;
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
    const loadCustom = () => {
      fetch("/api/models/custom", { cache: "no-store", signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          const list = (d.models || []).filter((m) => getModelKind(m) === "stt" && m.providerAlias === providerAliasRef.current);
          setCustomSttModels(list);
        })
        .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    };
    // eslint-disable-next-line react-doctor/no-initialize-state -- async fetch cannot use useState initializer
    loadCustom();
    window.addEventListener("focus", loadCustom);
    window.addEventListener("customModelChanged", loadCustom);
    return () => {
      controller.abort();
      window.removeEventListener("focus", loadCustom);
      window.removeEventListener("customModelChanged", loadCustom);
    };
  }, []);

  const endpoint = connection.useTunnel ? connection.tunnelEndpoint : connection.localEndpoint;
  const modelFull = form.selectedModel ? `${providerAlias}/${form.selectedModel}` : "";

  const curlSnippet = `curl -X POST ${endpoint}/v1/audio/transcriptions \\
  -H "Authorization: Bearer ${connection.apiKey || "YOUR_KEY"}" \\
  -F "file=@${form.audioFile?.name || "audio.mp3"}" \\
  -F "model=${modelFull}"${allowedParams.includes("language") && form.language ? ` \\\n  -F "language=${form.language}"` : ""}${allowedParams.includes("response_format") ? ` \\\n  -F "response_format=${form.responseFormat}"` : ""}${allowedParams.includes("temperature") && form.temperature ? ` \\\n  -F "temperature=${form.temperature}"` : ""}${allowedParams.includes("prompt") && form.prompt ? ` \\\n  -F "prompt=${form.prompt}"` : ""}`;

  const handleRun = async () => {
    if (!form.audioFile || !modelFull) return;
    dispatchRequest({ type: 'SET_RUNNING' });
    const start = Date.now();
    try {
      const fd = new FormData();
      fd.append("file", form.audioFile);
      fd.append("model", modelFull);
      if (allowedParams.includes("language") && form.language) fd.append("language", form.language);
      if (allowedParams.includes("response_format")) fd.append("response_format", form.responseFormat);
      if (allowedParams.includes("temperature") && form.temperature) fd.append("temperature", form.temperature);
      if (allowedParams.includes("prompt") && form.prompt) fd.append("prompt", form.prompt);

      const headers = {};
      if (connection.apiKey) headers["Authorization"] = `Bearer ${connection.apiKey}`;
      const res = await fetch("/api/v1/audio/transcriptions", { method: "POST", headers, body: fd });
      const sttLatency = Date.now() - start;
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : await res.text();
      if (!res.ok) {
        dispatchRequest({ type: 'SET_ERROR', payload: data?.error?.message || data?.error || data || `HTTP ${res.status}` });
        return;
      }
      dispatchRequest({ type: 'SET_RESULT', payload: { data, latency: sttLatency } });
    } catch (e) {
      dispatchRequest({ type: 'SET_ERROR', payload: e.message || "Network error" });
    }
  };

  const resultStr = typeof result === "string" ? result : (result ? JSON.stringify(result, null, 2) : `{\n  "text": "Hello world..."\n}`);

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">Example</h2>
      <div className="flex flex-col gap-2.5">
        {/* Model */}
        {sttModels.length > 0 ? (
          <Row label="Model">
            <select
              value={form.selectedModel}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'selectedModel', value: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            >
              {sttModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.id}</option>
              ))}
            </select>
          </Row>
        ) : (
          <Row label="Model">
            <input
              value={form.selectedModel}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'selectedModel', value: e.target.value })}
              placeholder="Enter model id"
              aria-label="Model"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
            />
          </Row>
        )}

        {/* Endpoint */}
        <Row label="Endpoint">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <span className="w-full min-w-0 flex-1 px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate">
              {endpoint}/v1/audio/transcriptions
            </span>
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
          <span className="px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate block">
            {connection.apiKey ? `${connection.apiKey.slice(0, 8)}${"•".repeat(Math.min(20, connection.apiKey.length - 8))}` : <span className="text-text-muted italic">No key configured</span>}
          </span>
        </Row>

        {/* Audio file */}
        <Row label="Audio File">
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.flac,.webm,.opus"
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'audioFile', value: e.target.files?.[0] || null })}
              aria-label="Audio file"
              className="w-full text-xs text-text-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border file:border-border file:bg-background file:text-text-main hover:file:bg-sidebar file:cursor-pointer"
            />
            {form.audioFile && (
              <span className="text-xs text-text-muted font-mono">
                {form.audioFile.name} · {(form.audioFile.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
        </Row>

        {/* Language (if model supports) */}
        {allowedParams.includes("language") && (
          <Row label="Language">
            <input
              value={form.language}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'language', value: e.target.value })}
              placeholder="e.g. en, vi, ja (auto-detect if empty)"
              aria-label="Language"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
            />
          </Row>
        )}

        {/* Prompt (if model supports) */}
        {allowedParams.includes("prompt") && (
          <Row label="Prompt">
            <input
              value={form.prompt}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'prompt', value: e.target.value })}
              placeholder="optional context to improve accuracy"
              aria-label="Prompt"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
          </Row>
        )}

        {/* Temperature (if model supports) */}
        {allowedParams.includes("temperature") && (
          <Row label="Temperature">
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.temperature}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'temperature', value: e.target.value })}
              placeholder="0 - 1 (default 0)"
              aria-label="Temperature"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
          </Row>
        )}

        {/* Response format (if model supports) */}
        {allowedParams.includes("response_format") && (
          <Row label="Response Format">
            <select
              value={form.responseFormat}
              onChange={(e) => dispatchForm({ type: 'SET_FIELD', field: 'responseFormat', value: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            >
              <option value="json">json</option>
              <option value="text">text</option>
              <option value="srt">srt</option>
              <option value="verbose_json">verbose_json</option>
              <option value="vtt">vtt</option>
            </select>
          </Row>
        )}

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
                disabled={running || !form.audioFile || !modelFull}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[14px]" style={running ? { animation: "spin 1s linear infinite" } : undefined}>
                  play_arrow
                </span>
                {running ? "Transcribing..." : "Run"}
              </button>
            </div>
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all">{curlSnippet}</pre>
        </div>

        {error && <p className="text-xs text-red-500 break-words">{error}</p>}

        {/* Response */}
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response {result && latency && <span className="font-normal normal-case">&#9889; {latency}ms</span>}
            </span>
            {result && (
              <button
                type="button"
                onClick={() => copyRes(resultStr)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">{copiedRes ? "check" : "content_copy"}</span>
                {copiedRes ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all opacity-70">
            {resultStr}
          </pre>
        </div>
      </div>
    </Card>
  );
}
