"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import Image from "next/image";
import { Card } from "@/shared/components";
import { MEDIA_PROVIDER_KINDS, getProviderAlias, resolveProviderId } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Row, KIND_EXAMPLE_CONFIG } from "./exampleShared";

const CLOUDFLARE_TEST_IMAGE_URL = "https://pub-1fb693cb11cc46b2b2f656f51e015a2c.r2.dev/dog.png";
const CLOUDFLARE_TEST_MASK_URL = "https://pub-1fb693cb11cc46b2b2f656f51e015a2c.r2.dev/dog-mask.png";

function getImageEditDefaults(providerId, modelId) {
  if (providerId !== "cloudflare-ai") return {};
  if (modelId === "@cf/runwayml/stable-diffusion-v1-5-img2img") {
    return { image: CLOUDFLARE_TEST_IMAGE_URL };
  }
  if (modelId === "@cf/runwayml/stable-diffusion-v1-5-inpainting") {
    return { image: CLOUDFLARE_TEST_IMAGE_URL, mask_image: CLOUDFLARE_TEST_MASK_URL };
  }
  return {};
}

function toImagePreviewSrc(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (/^(data:image\/|https?:\/\/)/i.test(trimmed)) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

// Mask large b64_json strings in JSON view to keep it readable
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

// ── Reducer ─────────────────────────────────────────────────────

function formReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_EXTRA":
      return { ...state, extraValues: { ...state.extraValues, [action.key]: action.value } };
    case "SET_RESULT":
      return { ...state, result: action.result, running: false, error: action.error ?? "" };
    case "SET_RUNNING":
      return { ...state, running: true, result: null, error: "", progress: null, partialImage: null };
    case "SET_STREAM_EVENT":
      return { ...state, [action.field]: action.value };
    case "SET_CONNECTIONS":
      return { ...state, connections: action.connections };
    default:
      return state;
  }
}

// ── Sub-components ──────────────────────────────────────────────

function ModelSelector({ kindModels, selectedModel, onSelect, allowManualModel }) {
  if (kindModels.length > 0) {
    return (
      <Row label="Model">
        <select
          value={selectedModel}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Model"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
        >
          {kindModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name || m.id}</option>
          ))}
        </select>
      </Row>
    );
  }
  if (allowManualModel) {
    return (
      <Row label="Model">
        <input
          value={selectedModel}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="Enter model id (provider-specific)"
          aria-label="Model"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
        />
      </Row>
    );
  }
  return null;
}

function EndpointRow({ endpoint, apiPath, tunnelEndpoint, useTunnel, onToggleTunnel }) {
  return (
    <Row label="Endpoint">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <span className="w-full min-w-0 flex-1 px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate">
          {endpoint}{apiPath}
        </span>
        {tunnelEndpoint && (
          <button
            type="button"
            onClick={onToggleTunnel}
            title={useTunnel ? "Using tunnel" : "Using local"}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border shrink-0 transition-colors ${
              useTunnel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-text-muted hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">wifi_tethering</span>
            Tunnel
          </button>
        )}
      </div>
    </Row>
  );
}

function ImagePreviewRow({ label, value, onChange, placeholder, ariaLabel, previewSrc, defaults }) {
  return (
    <Row label={label}>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <input
            value={value}
            onChange={onChange}
            placeholder={defaults || placeholder}
            aria-label={ariaLabel}
            className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange({ target: { value: "" } })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
        {previewSrc && (
          <div className="relative max-h-40 w-full">
            <Image
              src={previewSrc}
              alt={ariaLabel}
              width={600}
              height={160}
              unoptimized
              className="rounded-lg border border-border object-contain bg-sidebar"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              onLoad={(e) => { e.currentTarget.style.display = "block"; }}
            />
          </div>
        )}
      </div>
    </Row>
  );
}

function ExtraFields({ fields, kindModels, selectedModelObj, extraValues, onSetExtra }) {
  const paramsSet = Array.isArray(selectedModelObj?.params) ? new Set(selectedModelObj.params) : null;
  return fields.reduce((acc, f) => {
    if (kindModels.length === 0 || (paramsSet && paramsSet.has(f.key))) {
      acc.push(
        <Row key={f.key} label={f.label}>
          {f.type === "select" ? (
            <select
              value={extraValues[f.key] ?? ""}
              onChange={(e) => onSetExtra(f.key, e.target.value)}
              aria-label={f.label}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            >
              {(f.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt === "" ? "(default)" : opt}</option>
              ))}
            </select>
          ) : f.type === "text" ? (
            <input
              type="text"
              value={extraValues[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => onSetExtra(f.key, e.target.value)}
              aria-label={f.label}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
          ) : (
            <input
              type="number"
              value={extraValues[f.key] ?? ""}
              min={f.min}
              max={f.max}
              onChange={(e) => onSetExtra(f.key, e.target.value === "" ? "" : Number(e.target.value))}
              aria-label={f.label}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
          )}
        </Row>
      );
    }
    return acc;
  }, []);
}

function CurlRequestSection({ curlSnippet, onCopy, copied, onRun, running, disabled }) {
  return (
    <div className="mt-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Request</span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onCopy(curlSnippet)}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={disabled}
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
  );
}

function StreamingProgress({ running, progress, useStreaming }) {
  if (!(running || progress) || !useStreaming) return null;
  return (
    <div className="flex flex-col gap-2 px-3 py-2 rounded-lg bg-sidebar border border-border sm:flex-row sm:items-center sm:gap-3">
      <span className="material-symbols-outlined text-[16px] text-primary" style={running ? { animation: "spin 1s linear infinite" } : undefined}>
        {running ? "progress_activity" : "check_circle"}
      </span>
      <span className="text-xs text-text-muted">
        {progress?.stage || "starting"}
        {!running && progress?.bytesReceived ? ` · ${(progress.bytesReceived / 1024).toFixed(1)} KB` : ""}
      </span>
    </div>
  );
}

function ResultDisplay({ result, error, resultJson, kind, binaryImageUrl, defaultResponse, onCopy, copied }) {
  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Response {result && <span className="font-normal normal-case">&#9889; {result.latencyMs}ms</span>}
        </span>
        {result && (
          <button
            type="button"
            onClick={() => onCopy(resultJson)}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all opacity-70">
        {result ? resultJson : defaultResponse}
      </pre>
      {kind === "image" && (binaryImageUrl || result?.data?.data?.[0]) && (
        <div className="mt-2">
          <div className="flex items-center justify-end mb-1.5">
            <a
              href={binaryImageUrl || (result?.data?.data?.[0]?.b64_json ? `data:image/png;base64,${result.data.data[0].b64_json}` : result?.data?.data?.[0]?.url || "")}
              download="image.png"
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download
            </a>
          </div>
          <Image
            src={binaryImageUrl || (result?.data?.data?.[0]?.b64_json ? `data:image/png;base64,${result.data.data[0].b64_json}` : result?.data?.data?.[0]?.url)}
            alt="Generated"
            width={1024}
            height={1024}
            unoptimized
            className="max-w-full rounded-lg border border-border"
          />
        </div>
      )}
    </div>
  );
}

// ── Helper functions ─────────────────────────────────────────────

function buildRequestBody({ modelFull, exConfig, input, extraValues, supportsEdit, effectiveRefImage, supportsMask, effectiveMaskImage }) {
  const extraBodyFromFields = Object.entries(extraValues).reduce((acc, [k, v]) => {
    if (v === "" || v === null || v === undefined) return acc;
    if (typeof v === "number" && Number.isNaN(v)) return acc;
    acc[k] = v;
    return acc;
  }, {});
  return {
    model: modelFull,
    [exConfig.bodyKey]: input,
    ...exConfig.extraBody,
    ...extraBodyFromFields,
    ...(supportsEdit && effectiveRefImage ? { image: effectiveRefImage } : {}),
    ...(supportsMask && effectiveMaskImage ? { mask_image: effectiveMaskImage } : {}),
  };
}

async function executeExampleRun({ dispatch, input, modelFull, kindConfig, apiKey, pinnedConnectionId, useStreaming, requestBody, apiPathWithQuery, wantBinary, binaryImageUrl }) {
  if (!input.trim() || !modelFull) return;
  dispatch({ type: "SET_RUNNING" });
  if (binaryImageUrl) { try { URL.revokeObjectURL(binaryImageUrl); } catch {} dispatch({ type: "SET_FIELD", field: "binaryImageUrl", value: "" }); }
  const start = Date.now();
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    if (pinnedConnectionId) headers["x-connection-id"] = pinnedConnectionId;
    if (useStreaming) headers["Accept"] = "text/event-stream";
    const body = { ...requestBody, model: modelFull };
    const res = await fetch(`/api${apiPathWithQuery}`, {
      method: kindConfig.endpoint.method,
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      dispatch({ type: "SET_RESULT", error: data?.error?.message || data?.error || `HTTP ${res.status}` });
      return;
    }
    const ctype = res.headers.get("content-type") || "";
    if (ctype.startsWith("image/")) {
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      dispatch({ type: "SET_FIELD", field: "binaryImageUrl", value: objUrl });
      dispatch({ type: "SET_RESULT", result: { data: { binary: true, mime: ctype, size: blob.size }, latencyMs: Date.now() - start } });
      return;
    }
    const isSse = ctype.startsWith("text/event-stream");
    if (isSse && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalData = null;
      let streamErr = null;
      while (true) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: streaming chunks from reader
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sep;
        // eslint-disable-next-line react-doctor/js-set-map-lookups -- string indexOf, not array lookup
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          let evt = null, dataStr = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) evt = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!evt) continue;
          try {
            const payload = dataStr ? JSON.parse(dataStr) : {};
            if (evt === "progress") dispatch({ type: "SET_STREAM_EVENT", field: "progress", value: payload });
            else if (evt === "partial_image") dispatch({ type: "SET_STREAM_EVENT", field: "partialImage", value: payload });
            else if (evt === "done") finalData = payload;
            else if (evt === "error") streamErr = payload?.message || "Stream error";
          } catch {}
        }
      }
      const latencyMs = Date.now() - start;
      if (streamErr) { dispatch({ type: "SET_RESULT", error: streamErr }); return; }
      if (finalData) dispatch({ type: "SET_RESULT", result: { data: finalData, latencyMs } });
    } else {
      const data = await res.json();
      const latencyMs = Date.now() - start;
      dispatch({ type: "SET_RESULT", result: { data, latencyMs } });
    }
  } catch (e) {
    dispatch({ type: "SET_RESULT", error: e.message || "Network error" });
  }
}

// ── Extracted sub-components for main card ────────────────────────

function ExampleFormSection({ kindModels, selectedModel, dispatch, endpoint, apiPath, tunnelEndpoint, useTunnel, apiKey, connections, pinnedConnectionId, exConfig, input, supportsEdit, supportsMask, refImage, maskImage, refImagePreviewSrc, maskImagePreviewSrc, imageEditDefaults, kind, extraValues, selectedModelObj, allowManualModel, imageOutputFormat }) {
  return (
    <>
      <ModelSelector
        kindModels={kindModels}
        selectedModel={selectedModel}
        onSelect={(v) => dispatch({ type: "SET_FIELD", field: "selectedModel", value: v })}
        allowManualModel={allowManualModel}
      />

      <EndpointRow
        endpoint={endpoint}
        apiPath={apiPath}
        tunnelEndpoint={tunnelEndpoint}
        useTunnel={useTunnel}
        onToggleTunnel={() => dispatch({ type: "SET_FIELD", field: "useTunnel", value: !useTunnel })}
      />

      <Row label="API Key">
        <span className="px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate block">
          {apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(Math.min(20, apiKey.length - 8))}` : <span className="text-text-muted italic">No key configured</span>}
        </span>
      </Row>

      {connections.length > 0 && (
        <Row label="Connection">
          <select
            value={pinnedConnectionId}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "pinnedConnectionId", value: e.target.value })}
            aria-label="Connection"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            <option value="">Auto (by priority)</option>
            {connections.map((c) => {
              const plan = c.providerSpecificData?.chatgptPlanType;
              const label = c.email || c.name || c.id.slice(0, 8);
              return (
                <option key={c.id} value={c.id}>
                  {label}{plan ? ` [${plan}]` : ""}
                </option>
              );
            })}
          </select>
        </Row>
      )}

      <Row label={exConfig.inputLabel}>
        <div className="relative">
          <input
            value={input}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "input", value: e.target.value })}
            placeholder={exConfig.inputPlaceholder}
            aria-label={exConfig.inputLabel || "Input"}
            className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
          {input && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_FIELD", field: "input", value: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </Row>

      {supportsEdit && (
        <ImagePreviewRow
          label="Ref Image (URL)"
          value={refImage}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "refImage", value: e.target.value })}
          placeholder="https://example.com/source.png"
          ariaLabel="Reference image URL"
          previewSrc={refImagePreviewSrc}
          defaults={imageEditDefaults.image}
        />
      )}

      {supportsMask && (
        <ImagePreviewRow
          label="Mask (URL)"
          value={maskImage}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "maskImage", value: e.target.value })}
          placeholder="https://example.com/mask.png"
          ariaLabel="Mask image URL"
          previewSrc={maskImagePreviewSrc}
          defaults={imageEditDefaults.mask_image}
        />
      )}

      <ExtraFields
        fields={exConfig.extraFields || []}
        kindModels={kindModels}
        selectedModelObj={selectedModelObj}
        extraValues={extraValues}
        onSetExtra={(key, value) => dispatch({ type: "SET_EXTRA", key, value })}
      />

      {kind === "image" && (
        <Row label="Output Format">
          <select
            value={imageOutputFormat}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "imageOutputFormat", value: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            <option value="json">JSON (Base64)</option>
            <option value="binary">Binary File</option>
          </select>
        </Row>
      )}
    </>
  );
}

function ExampleResultSection({ curlSnippet, copiedCurl, copyCurl, handleRun, running, input, modelFull, progress, useStreaming, partialImage, result, error, kind, binaryImageUrl, resultJson, exConfig, copiedRes, copyRes }) {
  return (
    <>
      <CurlRequestSection
        curlSnippet={curlSnippet}
        onCopy={copyCurl}
        copied={copiedCurl}
        onRun={handleRun}
        running={running}
        disabled={running || !input.trim() || !modelFull}
      />

      <StreamingProgress running={running} progress={progress} useStreaming={useStreaming} />

      {partialImage?.b64_json && !result && (
        <div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Partial preview</span>
          <Image
            src={`data:image/png;base64,${partialImage.b64_json}`}
            alt="Partial"
            width={512}
            height={512}
            unoptimized
            className="max-w-full rounded-lg border border-border mt-1.5 opacity-80"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500 break-words">{error}</p>}

      <ResultDisplay
        result={result}
        error={error}
        resultJson={resultJson}
        kind={kind}
        binaryImageUrl={binaryImageUrl}
        defaultResponse={exConfig.defaultResponse}
        onCopy={copyRes}
        copied={copiedRes}
      />
    </>
  );
}

// ── Main component ──────────────────────────────────────────────

export function GenericExampleCard({ providerId, kind }) {
  const providerAlias = getProviderAlias(providerId);
  const resolvedId = resolveProviderId(providerAlias);
  const safeProviderAlias = resolvedId === providerId ? providerAlias : providerId;
  const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kind);
  const exConfig = KIND_EXAMPLE_CONFIG[kind];
  const safeExConfig = exConfig || {};

  const kindModels = getModelsByProviderId(providerId).filter((m) => getModelKind(m) === kind);
  const KIND_NEEDS_MODEL = new Set(["image", "video", "music", "imageToText"]);
  const needsModel = KIND_NEEDS_MODEL.has(kind);
  const allowManualModel = needsModel && kindModels.length === 0;

  const [state, dispatch] = useReducer(formReducer, {
    selectedModel: kindModels[0]?.id ?? "",
    input: safeExConfig.defaultInput || "",
    refImage: "",
    maskImage: "",
    extraValues: (safeExConfig.extraFields || []).reduce((acc, f) => { acc[f.key] = f.default ?? ""; return acc; }, {}),
    apiKey: "",
    useTunnel: false,
    localEndpoint: "",
    tunnelEndpoint: "",
    result: null,
    progress: null,
    partialImage: null,
    imageOutputFormat: "json",
    binaryImageUrl: "",
    running: false,
    error: "",
    connections: [],
    pinnedConnectionId: "",
  });

  const { copied: copiedCurl, copy: copyCurl } = useCopyToClipboard();
  const { copied: copiedRes, copy: copyRes } = useCopyToClipboard();
  const providerIdRef = useRef(providerId);
  providerIdRef.current = providerId;

  useEffect(() => {
    dispatch({ type: "SET_FIELD", field: "localEndpoint", value: window.location.origin });
    const controller = new AbortController();
    const pid = providerIdRef.current;
    fetch("/api/keys", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { dispatch({ type: "SET_FIELD", field: "apiKey", value: (d.keys || []).find((k) => k.isActive !== false)?.key || "" }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    fetch("/api/tunnel/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { if (d.publicUrl) dispatch({ type: "SET_FIELD", field: "tunnelEndpoint", value: d.publicUrl }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    fetch("/api/providers/client", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const conns = (d.connections || []).filter((c) => c.provider === pid && c.isActive !== false);
        dispatch({ type: "SET_CONNECTIONS", connections: conns });
      })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, []);

  if (!kindConfig || !exConfig) return null;

  const { selectedModel, input, refImage, maskImage, extraValues, apiKey, useTunnel, localEndpoint, tunnelEndpoint, result, progress, partialImage, imageOutputFormat, binaryImageUrl, running, error, connections, pinnedConnectionId } = state;

  const selectedModelObj = kindModels.find((m) => m.id === selectedModel);
  const capsSet = new Set(selectedModelObj?.capabilities);
  const supportsEdit = capsSet.has("edit");
  const supportsMask = capsSet.has("mask");
  const endpoint = useTunnel ? tunnelEndpoint : localEndpoint;
  const apiPath = kindConfig.endpoint.path;
  const modelFull = !needsModel
    ? safeProviderAlias
    : (selectedModel ? `${safeProviderAlias}/${selectedModel}` : (allowManualModel ? "" : safeProviderAlias));
  const imageEditDefaults = getImageEditDefaults(providerId, selectedModel);
  const effectiveRefImage = refImage.trim() || imageEditDefaults.image || "";
  const effectiveMaskImage = maskImage.trim() || imageEditDefaults.mask_image || "";
  const refImagePreviewSrc = toImagePreviewSrc(effectiveRefImage);
  const maskImagePreviewSrc = toImagePreviewSrc(effectiveMaskImage);

  const requestBody = buildRequestBody({ modelFull, exConfig, input, extraValues, supportsEdit, effectiveRefImage, supportsMask, effectiveMaskImage });

  const wantBinary = kind === "image" && imageOutputFormat === "binary";
  const useStreaming = kind === "image" && providerId === "codex" && !wantBinary;
  const apiPathWithQuery = `${apiPath}${wantBinary ? "?response_format=binary" : ""}`;
  const headersPreview = `-H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${apiKey || "YOUR_KEY"}"${pinnedConnectionId ? ` \\\n  -H "x-connection-id: ${pinnedConnectionId}"` : ""}${useStreaming ? ` \\\n  -H "Accept: text/event-stream"` : ""}`;
  const curlSnippet = `curl -X ${kindConfig.endpoint.method} ${endpoint}${apiPathWithQuery} \\
  ${headersPreview.replace(/\\\n  /g, "\\\n  ")} \\
  -d '${JSON.stringify(requestBody)}'${wantBinary ? " \\\n  --output image.png" : ""}`;

  const handleRun = () => executeExampleRun({ dispatch, input, modelFull, kindConfig, apiKey, pinnedConnectionId, useStreaming, requestBody, apiPathWithQuery, wantBinary, binaryImageUrl });

  const resultJson = result ? JSON.stringify(maskB64(result.data), null, 2) : "";

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">Example</h2>
      <div className="flex flex-col gap-2.5">
        <ExampleFormSection
          kindModels={kindModels}
          selectedModel={selectedModel}
          dispatch={dispatch}
          endpoint={endpoint}
          apiPath={apiPath}
          tunnelEndpoint={tunnelEndpoint}
          useTunnel={useTunnel}
          apiKey={apiKey}
          connections={connections}
          pinnedConnectionId={pinnedConnectionId}
          exConfig={exConfig}
          input={input}
          supportsEdit={supportsEdit}
          supportsMask={supportsMask}
          refImage={refImage}
          maskImage={maskImage}
          refImagePreviewSrc={refImagePreviewSrc}
          maskImagePreviewSrc={maskImagePreviewSrc}
          imageEditDefaults={imageEditDefaults}
          kind={kind}
          extraValues={extraValues}
          selectedModelObj={selectedModelObj}
          allowManualModel={allowManualModel}
          imageOutputFormat={imageOutputFormat}
        />

        <ExampleResultSection
          curlSnippet={curlSnippet}
          copiedCurl={copiedCurl}
          copyCurl={copyCurl}
          handleRun={handleRun}
          running={running}
          input={input}
          modelFull={modelFull}
          progress={progress}
          useStreaming={useStreaming}
          partialImage={partialImage}
          result={result}
          error={error}
          kind={kind}
          binaryImageUrl={binaryImageUrl}
          resultJson={resultJson}
          exConfig={exConfig}
          copiedRes={copiedRes}
          copyRes={copyRes}
        />
      </div>
    </Card>
  );
}
