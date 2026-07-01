"use client";

import { useEffect, useRef, useReducer, useMemo } from "react";
import { Card } from "@/shared/components";
import { AI_PROVIDERS, getProviderAlias } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { TTS_PROVIDER_CONFIG } from "@/shared/constants/ttsProviders";
import { getTtsVoicesForModel } from "open-sse/config/ttsModels.js";
import { GOOGLE_TTS_LANGUAGES } from "open-sse/config/googleTtsLanguages.js";
import { Row } from "./exampleShared";

const DEFAULT_TTS_RESPONSE_EXAMPLE = `// Audio will appear here after running.
// Example JSON response (response_format=json):
{
  "format": "mp3",
  "audio": "//NExAANaAIIAUAAANNNNNNNN..." // base64 encoded MP3
}`;

function getInitialVoiceState(config, providerId) {
  const result = { voice: config.defaultVoiceId || "", lang: "", voices: [], voiceName: "" };
  if (config.voiceSource !== "hardcoded") return result;
  const defaultModel = config.hasModelSelector && config.modelKey
    ? (getModelsByProviderId(config.modelKey)?.[0]?.id || "")
    : "";
  const voices = (config.voicesPerModel && defaultModel)
    ? (getTtsVoicesForModel(providerId, defaultModel) || [])
    : getModelsByProviderId(config.voiceKey || providerId).filter((m) => getModelKind(m) === "tts");
  if (!voices.length) return result;
  if (config.hasBrowseButton) {
    const dv = voices.find((v) => v.id === "en") || voices[0];
    return { voice: dv.id, lang: dv.id, voices: [{ id: dv.id, name: dv.name }], voiceName: dv.name };
  }
  return { voice: voices[0].id, lang: "", voices, voiceName: voices[0].name || voices[0].id };
}

function voiceReducer(state, action) {
  switch (action.type) {
    case "SET_SELECTION": return { ...state, userVoiceSelection: action.payload };
    case "SET_VOICE_ID": return { ...state, voiceId: action.payload };
    case "SET_BROWSE_VOICES": return { ...state, browseCountryVoices: action.payload };
    case "SET_LANG": return { ...state, selectedLang: action.payload };
    case "SET_MODEL": return { ...state, selectedModel: action.payload };
    default: return state;
  }
}

function requestReducer(state, action) {
  switch (action.type) {
    case "SET_RUNNING": return { ...state, running: true, error: "", audioUrl: "", jsonResponse: null, latency: null };
    case "SET_AUDIO": return { ...state, running: false, audioUrl: action.payload.audioUrl, latency: action.payload.latency };
    case "SET_JSON_AUDIO": return { ...state, running: false, audioUrl: action.payload.audioUrl, jsonResponse: action.payload.jsonResponse, latency: action.payload.latency };
    case "SET_ERROR": return { ...state, running: false, error: action.payload };
    default: return state;
  }
}

function formReducer(state, action) {
  switch (action.type) {
    case "SET_INPUT": return { ...state, input: action.payload };
    case "SET_API_KEY": return { ...state, apiKey: action.payload };
    case "TOGGLE_TUNNEL": return { ...state, useTunnel: !state.useTunnel };
    case "SET_TUNNEL_ENDPOINT": return { ...state, tunnelEndpoint: action.payload };
    case "SET_RESPONSE_FORMAT": return { ...state, responseFormat: action.payload };
    case "SET_LANGUAGE_HINT": return { ...state, languageHint: action.payload };
    default: return state;
  }
}

function modalReducer(state, action) {
  switch (action.type) {
    case "OPEN": return { ...state, modalOpen: true, modalSearch: "", modalError: "" };
    case "CLOSE": return { ...state, modalOpen: false };
    case "SET_LOADING": return { ...state, modalLoading: action.payload };
    case "SET_LANGUAGES": return { ...state, languages: action.payload, modalLoading: false };
    case "SET_ERROR": return { ...state, modalError: action.payload, modalLoading: false };
    case "SET_SEARCH": return { ...state, modalSearch: action.payload };
    default: return state;
  }
}

/* ---------- Sub-components ---------- */

function TtsFormFields({ config, providerId, voice, voiceDispatch, form, formDispatch, countryVoices, languages, openModal, voiceNameRef, endpoint }) {
  const handleModelChange = (e) => {
    const newModel = e.target.value;
    voiceDispatch({ type: "SET_MODEL", payload: newModel });
    if (config.voicesPerModel && newModel) {
      const voices = getTtsVoicesForModel(providerId, newModel) || [];
      voiceDispatch({ type: "SET_BROWSE_VOICES", payload: voices });
      if (voices.length) {
        voiceDispatch({ type: "SET_SELECTION", payload: voices[0].id });
        voiceNameRef.current = voices[0].name || voices[0].id;
      }
    }
  };
  return (
    <>
      {/* Endpoint + API Key as read-only text */}
      <Row label="Endpoint">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <span className="w-full min-w-0 flex-1 px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate">
            {endpoint}/v1/audio/speech
          </span>
          {form.tunnelEndpoint && (
            <button
              type="button"
              onClick={() => formDispatch({ type: "TOGGLE_TUNNEL" })}
              title={form.useTunnel ? "Using tunnel" : "Using local"}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border shrink-0 transition-colors ${
                form.useTunnel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-text-muted hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">wifi_tethering</span>
              Tunnel
            </button>
          )}
        </div>
      </Row>
      <Row label="API Key">
        <span className="px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate block">
          {form.apiKey ? `${form.apiKey.slice(0, 8)}${"•".repeat(Math.min(20, form.apiKey.length - 8))}` : <span className="text-text-muted italic">No key configured</span>}
        </span>
      </Row>

      {/* Model selector */}
      {config.hasModelSelector && (config.modelKey || getModelsByProviderId(providerId).some(m => getModelKind(m) === "tts")) && (
        <Row label="Model">
          <select
            value={voice.selectedModel}
            onChange={handleModelChange}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            {(() => {
              const ttsModels = getModelsByProviderId(providerId).filter(m => getModelKind(m) === "tts");
              return (ttsModels.length ? ttsModels : getModelsByProviderId(config.modelKey) || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.id}</option>
              ));
            })()}
          </select>
        </Row>
      )}

      {/* Language hint dropdown (Gemini) — sends body.language to guide pronunciation */}
      {config.hasLanguageHint && (
        <Row label="Language">
          <select
            value={form.languageHint}
            onChange={(e) => formDispatch({ type: "SET_LANGUAGE_HINT", payload: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            <option value="">Auto-detect</option>
            {GOOGLE_TTS_LANGUAGES.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>
        </Row>
      )}

      {/* Language row + Browse button (edge-tts, local-device, elevenlabs) */}
      {config.hasBrowseButton && (
        <Row label="Language">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={openModal}
              className="w-full min-w-0 flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background font-mono truncate text-left hover:border-primary/40 transition-colors"
            >
              {voice.selectedLang
                ? <span className="text-text-main">{languages.find((l) => l.code === voice.selectedLang)?.name || voice.selectedLang}</span>
                : <span className="text-text-muted">No language selected</span>}
            </button>
            <button
              type="button"
              onClick={openModal}
              className="flex w-full items-center justify-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors sm:w-auto sm:shrink-0"
            >
              <span className="material-symbols-outlined text-[14px]">language</span>
              Select language
            </button>
          </div>
        </Row>
      )}

      {/* Voice chips — shown after language picked (edge-tts, local-device) or always (OpenAI/ElevenLabs) */}
      {countryVoices.length > 0 && (
        <Row label="Voice">
          <div className="flex flex-wrap gap-1.5">
            {countryVoices.map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => {
                  voiceDispatch({ type: "SET_SELECTION", payload: v.id });
                  voiceNameRef.current = v.name;
                  if (config.hasVoiceIdInput) voiceDispatch({ type: "SET_VOICE_ID", payload: v.id });
                }}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  voice.userVoiceSelection === v.id
                    ? "bg-primary/15 border-primary/40 text-primary font-medium"
                    : "border-border text-text-muted hover:text-primary hover:border-primary/40"
                }`}
              >
                {v.name}{v.gender ? ` · ${v.gender[0].toUpperCase()}` : ""}
                {v.free_users_allowed === true && (
                  <span className="ml-1.5 px-1 py-0.5 text-[9px] font-semibold rounded bg-green-500/15 text-green-600 border border-green-500/20">Free</span>
                )}
                {v.free_users_allowed === false && (
                  <span className="ml-1.5 px-1 py-0.5 text-[9px] font-semibold rounded bg-amber-500/15 text-amber-600 border border-amber-500/20">Paid</span>
                )}
              </button>
            ))}
          </div>
        </Row>
      )}

      {/* Voice ID input (ElevenLabs) — manual entry or auto-fill from chip */}
      {config.hasVoiceIdInput && (
        <Row label="Voice ID">
          <div className="flex flex-col gap-1">
            <div className="relative">
              <input
                value={voice.voiceId}
                onChange={(e) => {
                  voiceDispatch({ type: "SET_VOICE_ID", payload: e.target.value });
                  voiceDispatch({ type: "SET_SELECTION", payload: e.target.value });
                }}
                placeholder="e.g. CwhRBWXzGAHq8TQ4Fs17"
                aria-label="Voice ID"
                className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary font-mono"
              />
              {voice.voiceId && (
                <button
                  type="button"
                  onClick={() => {
                    voiceDispatch({ type: "SET_VOICE_ID", payload: "" });
                    voiceDispatch({ type: "SET_SELECTION", payload: "" });
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>
        </Row>
      )}

      {/* Google TTS: Language dropdown */}
      {config.hasLanguageDropdown && (
        <Row label="Language">
          <select
            value={voice.userVoiceSelection}
            onChange={(e) => {
              const m = getModelsByProviderId(providerId).filter((m) => getModelKind(m) === "tts").find((m) => m.id === e.target.value);
              voiceDispatch({ type: "SET_SELECTION", payload: e.target.value });
              voiceNameRef.current = m?.name || e.target.value;
            }}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          >
            {getModelsByProviderId(providerId).reduce((acc, m) => { if (getModelKind(m) === "tts") acc.push(<option key={m.id} value={m.id}>{m.name || m.id}</option>); return acc; }, [])}
          </select>
        </Row>
      )}

      {/* Input */}
      <Row label="Input">
        <div className="relative">
          <input
            value={form.input}
            onChange={(e) => formDispatch({ type: "SET_INPUT", payload: e.target.value })}
            aria-label="Input text"
            className="w-full px-3 py-1.5 pr-7 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
          {form.input && (
            <button
              type="button"
              onClick={() => formDispatch({ type: "SET_INPUT", payload: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </Row>

      {/* Output Format */}
      <Row label="Output Format">
        <select
          value={form.responseFormat}
          onChange={(e) => formDispatch({ type: "SET_RESPONSE_FORMAT", payload: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
        >
          <option value="mp3">MP3 (Binary)</option>
          <option value="json">JSON (Base64)</option>
        </select>
      </Row>
    </>
  );
}

function TtsCurlSection({ curlSnippet, copiedCurl, copyCurl, handleRun, running, hasInput, modelFull }) {
  return (
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
            disabled={running || !hasInput || !modelFull}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[14px]" style={running ? { animation: "spin 1s linear infinite" } : undefined}>
              play_arrow
            </span>
            {running ? "Generating..." : "Run"}
          </button>
        </div>
      </div>
      <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all">{curlSnippet}</pre>
    </div>
  );
}

function TtsAudioPlayer({ error, audioUrl, latency, jsonResponse }) {
  return (
    <>
      {error && <p className="text-xs text-red-500 break-words">{error}</p>}

      {audioUrl ? (
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response {latency && <span className="font-normal normal-case">&#9889; {latency}ms</span>}
            </span>
            <a href={audioUrl} download="speech.mp3" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download
            </a>
          </div>
          <audio controls src={audioUrl} className="w-full" aria-label="Audio playback">
            <track kind="captions" />
          </audio>

          {/* JSON Response (if format is json) */}
          {jsonResponse && (
            <div className="mt-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">JSON Response</span>
              </div>
              <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify({
                  format: jsonResponse.format,
                  audio: jsonResponse.audio ? `${jsonResponse.audio.substring(0, 100)}...` : ""
                }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Response</span>
          <pre className="mt-1.5 bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all opacity-50">{DEFAULT_TTS_RESPONSE_EXAMPLE}</pre>
        </div>
      )}
    </>
  );
}

function CountryPickerModal({ modalOpen, modalSearch, modalError, modalLoading, filteredLanguages, selectedLang, dispatchModal, handlePickLanguage }) {
  if (!modalOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
        onClick={() => dispatchModal({ type: "CLOSE" })}
        aria-label="Close country picker"
      />
      <div
        className="relative border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
        style={{ backgroundColor: "var(--color-bg)", isolation: "isolate" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 rounded-t-xl">
          <h3 className="text-sm font-semibold">Select Language</h3>
          <button type="button" onClick={() => dispatchModal({ type: "CLOSE" })} className="text-text-muted hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border shrink-0">
          <input
            value={modalSearch}
            onChange={(e) => dispatchModal({ type: "SET_SEARCH", payload: e.target.value })}
            placeholder="Search language..."
            aria-label="Search language"
            className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>

        {/* Language list */}
        <div className="overflow-y-auto flex-1 p-2">
          {modalError && <p className="text-xs text-red-500 px-2 py-1">{modalError}</p>}
          {modalLoading ? (
            <p className="text-xs text-text-muted px-2 py-3">Loading...</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filteredLanguages.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => handlePickLanguage(c)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left hover:bg-sidebar transition-colors ${
                    selectedLang === c.code ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <span className="text-sm">{c.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-muted">{c.voices.length} voices</span>
                    {selectedLang === c.code && (
                      <span className="material-symbols-outlined text-[16px] text-primary">check</span>
                    )}
                  </div>
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <p className="text-xs text-text-muted px-2 py-3">No languages found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export function TtsExampleCard({ providerId }) {
  const providerAlias = getProviderAlias(providerId);
  const config = TTS_PROVIDER_CONFIG[providerId] || TTS_PROVIDER_CONFIG["edge-tts"];

  // Voice state (useReducer)
  const initVoice = getInitialVoiceState(config, providerId);
  const voiceNameRef = useRef(initVoice.voiceName);
  const [voice, voiceDispatch] = useReducer(voiceReducer, { providerId, config, initVoice }, (args) => ({
    userVoiceSelection: args.initVoice.voice,
    voiceId: args.config.defaultVoiceId || "",
    browseCountryVoices: args.initVoice.voices,
    selectedLang: args.initVoice.lang,
    selectedModel: (() => {
      const cfgModels = AI_PROVIDERS[args.providerId]?.ttsConfig?.models;
      if (cfgModels?.length) return cfgModels[0].id;
      if (args.config.hasModelSelector && args.config.modelKey) {
        const models = getModelsByProviderId(args.config.modelKey);
        return models?.[0]?.id || "";
      }
      return "";
    })(),
  }));

  const modelCountryVoices = useMemo(() => {
    if (!config.voicesPerModel || !voice.selectedModel) return null;
    return getTtsVoicesForModel(providerId, voice.selectedModel) || [];
  }, [config.voicesPerModel, providerId, voice.selectedModel]);

  const countryVoices = modelCountryVoices ?? voice.browseCountryVoices;

  // Form state (useReducer)
  const [form, formDispatch] = useReducer(formReducer, null, () => ({
    input: "Hello, this is a text to speech test.",
    apiKey: "",
    useTunnel: false,
    localEndpoint: window.location.origin,
    tunnelEndpoint: "",
    responseFormat: "mp3",
    languageHint: "",
  }));

  const [{ audioUrl, jsonResponse, running, error, latency }, dispatchRequest] = useReducer(requestReducer, { audioUrl: "", jsonResponse: null, running: false, error: "", latency: null });
  const { copied: copiedCurl, copy: copyCurl } = useCopyToClipboard();

  // Country picker modal state
  const [{ modalOpen, languages, modalLoading, modalSearch, modalError }, dispatchModal] = useReducer(modalReducer, { modalOpen: false, languages: [], modalLoading: false, modalSearch: "", modalError: "" });
  const byLangRef = useRef({});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/keys", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { formDispatch({ type: "SET_API_KEY", payload: (d.keys || []).find((k) => k.isActive !== false)?.key || "" }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    fetch("/api/tunnel/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => { if (d.publicUrl) formDispatch({ type: "SET_TUNNEL_ENDPOINT", payload: d.publicUrl }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, []);


  // Open modal -- load language list
  const openModal = async () => {
    dispatchModal({ type: "OPEN" });
    if (languages.length) return; // already loaded
    dispatchModal({ type: "SET_LOADING", payload: true });
    try {
      if (config.voiceSource === "hardcoded") {
        // Build languages/byLang from static providerModels data
        const voiceKey = config.voiceKey || providerId;
        const voices = getModelsByProviderId(voiceKey).filter((m) => getModelKind(m) === "tts");
        const byLangMap = {};
        for (const v of voices) {
          if (!byLangMap[v.id]) byLangMap[v.id] = { code: v.id, name: v.name, voices: [{ id: v.id, name: v.name }] };
        }
        byLangRef.current = byLangMap;
        dispatchModal({ type: "SET_LANGUAGES", payload: Object.values(byLangMap).sort((a, b) => a.name.localeCompare(b.name)) });
      } else {
        // Use provider-specific apiEndpoint if available, else default to edge-tts voices API
        const url = config.apiEndpoint
          ? config.apiEndpoint
          : `/api/media-providers/tts/voices?provider=${providerId === "local-device" ? "local-device" : "edge-tts"}`;
        const r = await fetch(url);
        const d = await r.json();
        if (d.error) { dispatchModal({ type: "SET_ERROR", payload: d.error }); return; }
        dispatchModal({ type: "SET_LANGUAGES", payload: d.languages || [] });
        byLangRef.current = d.byLang || {};
      }
    } catch (e) {
      dispatchModal({ type: "SET_ERROR", payload: e.message });
    }
  };

  // Click language -> close modal -> show voices below
  const handlePickLanguage = (lang) => {
    dispatchModal({ type: "CLOSE" });
    voiceDispatch({ type: "SET_LANG", payload: lang.code });
    const voices = byLangRef.current[lang.code]?.voices || [];
    voiceDispatch({ type: "SET_BROWSE_VOICES", payload: voices });
    // Auto-select first voice
    if (voices.length) {
      voiceDispatch({ type: "SET_SELECTION", payload: voices[0].id });
      voiceNameRef.current = voices[0].name;
      if (config.hasVoiceIdInput) voiceDispatch({ type: "SET_VOICE_ID", payload: voices[0].id });
    }
  };

  const filteredLanguages = modalSearch
    ? languages.filter((c) =>
        c.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(modalSearch.toLowerCase())
      )
    : languages;

  const endpoint = form.useTunnel ? form.tunnelEndpoint : form.localEndpoint;
  // For ElevenLabs/config-driven: prefer manual voiceId (if any), else fall back to userVoiceSelection
  const activeVoiceId = config.hasVoiceIdInput ? (voice.voiceId || voice.userVoiceSelection) : voice.userVoiceSelection;
  const modelFull = (() => {
    if (config.hasModelSelector && voice.selectedModel && activeVoiceId) return `${providerAlias}/${voice.selectedModel}/${activeVoiceId}`;
    if (config.hasModelSelector && voice.selectedModel) return `${providerAlias}/${voice.selectedModel}`;
    if (activeVoiceId) return `${providerAlias}/${activeVoiceId}`;
    return "";
  })();

  const ttsBody = (() => {
    const b = { model: modelFull, input: form.input };
    if (config.hasLanguageHint && form.languageHint) b.language = form.languageHint;
    return b;
  })();
  const curlSnippet = `curl -X POST ${endpoint}/v1/audio/speech${form.responseFormat === "json" ? "?response_format=json" : ""} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${form.apiKey || "YOUR_KEY"}" \\
  -d '${JSON.stringify(ttsBody)}' \\
  ${form.responseFormat === "json" ? "" : "--output speech.mp3"}`;

  const handleRun = async () => {
    if (!form.input.trim() || !modelFull) return;
    dispatchRequest({ type: "SET_RUNNING" });
    const start = Date.now();
    try {
      const headers = { "Content-Type": "application/json" };
      if (form.apiKey) headers["Authorization"] = `Bearer ${form.apiKey}`;
      const url = `/api/v1/audio/speech${form.responseFormat === "json" ? "?response_format=json" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...ttsBody, input: form.input.trim() }),
      });
      const ttsLatency = Date.now() - start;
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        dispatchRequest({ type: "SET_ERROR", payload: d?.error?.message || d?.error || `HTTP ${res.status}` });
        return;
      }

      if (form.responseFormat === "json") {
        const data = await res.json();
        const audioBlob = await fetch(`data:audio/mp3;base64,${data.audio}`).then(r => r.blob());
        dispatchRequest({ type: "SET_JSON_AUDIO", payload: { audioUrl: URL.createObjectURL(audioBlob), jsonResponse: data, latency: ttsLatency } });
      } else {
        const blob = await res.blob();
        dispatchRequest({ type: "SET_AUDIO", payload: { audioUrl: URL.createObjectURL(blob), latency: ttsLatency } });
      }
    } catch (e) {
      dispatchRequest({ type: "SET_ERROR", payload: e.message || "Network error" });
    }
  };

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold mb-4">Example</h2>

        <div className="flex flex-col gap-2.5">
          <TtsFormFields
            config={config}
            providerId={providerId}
            voice={voice}
            voiceDispatch={voiceDispatch}
            form={form}
            formDispatch={formDispatch}
            countryVoices={countryVoices}
            languages={languages}
            openModal={openModal}
            voiceNameRef={voiceNameRef}
            endpoint={endpoint}
          />
          <TtsCurlSection
            curlSnippet={curlSnippet}
            copiedCurl={copiedCurl}
            copyCurl={copyCurl}
            handleRun={handleRun}
            running={running}
            hasInput={!!form.input.trim()}
            modelFull={modelFull}
          />
          <TtsAudioPlayer
            error={error}
            audioUrl={audioUrl}
            latency={latency}
            jsonResponse={jsonResponse}
          />
        </div>
      </Card>

      <CountryPickerModal
        modalOpen={modalOpen}
        modalSearch={modalSearch}
        modalError={modalError}
        modalLoading={modalLoading}
        filteredLanguages={filteredLanguages}
        selectedLang={voice.selectedLang}
        dispatchModal={dispatchModal}
        handlePickLanguage={handlePickLanguage}
      />
    </>
  );
}
