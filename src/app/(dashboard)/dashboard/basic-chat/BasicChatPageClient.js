"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Image from "next/image";
import { Badge, Button } from "@/shared/components";
import { getModelsByProviderId } from "@/shared/constants/models";
import { isAnthropicCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";

const STORAGE_KEYS = {
  sessions: "basic-chat.sessions",
  activeSessionId: "basic-chat.activeSessionId",
  activeProviderId: "basic-chat.activeProviderId",
  draft: "basic-chat.draft",
};

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureSessionForModel(model) {
  if (!model) return null;
  return {
    id: createId(),
    title: "New chat",
    providerId: model.providerId,
    providerName: model.providerName,
    modelId: model.id,
    modelName: model.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.flatMap((v) => { const t = textValue(v); return t ? [t] : []; }).join(" ");
  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function humanize(value = "") {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Unknown";
}

function formatRelativeTime(value) {
  if (!value) return "Now";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Now";
  const diffMinutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.round(diffHours / 24)}d`;
}

function makeSessionTitle(text = "") {
  const normalized = textValue(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  return normalized.length > 52 ? `${normalized.slice(0, 52).trimEnd()}…` : normalized;
}

function buildUserContent(message) {
  const text = textValue(message.content).trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  if (attachments.length === 0) return text;

  const content = [];
  if (text) content.push({ type: "text", text });

  for (const attachment of attachments) {
    if (attachment?.dataUrl) {
      content.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
    }
  }

  return content.length > 0 ? content : text;
}

function readAssistantText(chunk) {
  if (!chunk || typeof chunk !== "object") return "";
  const choice = chunk.choices?.[0];
  const delta = choice?.delta || {};
  const pieces = [delta.content, choice?.message?.content, chunk.output_text, chunk.text]
    .map(textValue)
    .filter(Boolean);
  return pieces[0] || "";
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function cloneSession(session) {
  return {
    ...session,
    messages: Array.isArray(session.messages) ? session.messages.map((message) => ({ ...message })) : [],
  };
}

function getProviderLabel(connection) {
  return connection?.name || humanize(connection?.provider || connection?.id || "provider");
}

function normalizeStaticModel(model, connection) {
  if (!model?.id) return null;
  return {
    id: `${connection.provider}/${model.id}`,
    requestModel: `${connection.provider}/${model.id}`,
    name: model.name || model.id,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "static",
  };
}

function normalizeLiveModel(model, connection) {
  const rawId = typeof model === "string" ? model : model?.id || model?.name || model?.model || "";
  if (!rawId) return null;

  const displayName = typeof model === "string"
    ? model
    : model?.name || model?.displayName || rawId;

  let requestModel = rawId;
  const isCompatible = isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider);
  if (isCompatible && !rawId.includes("/")) {
    requestModel = `${connection.provider}/${rawId}`;
  }

  return {
    id: requestModel,
    requestModel,
    name: displayName,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "live",
  };
}

function parseProviderModelsPayload(data) {
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function dedupeModels(models) {
  const map = new Map();
  for (const model of models) {
    if (!model?.id) continue;
    if (!map.has(model.id)) map.set(model.id, model);
  }
  return Array.from(map.values());
}

// --- Reducers ---

const initialFormState = {
  draft: "",
  attachments: [],
  isSending: false,
  streamingMessageId: "",
  streamingText: "",
};

function initFormState() {
  if (typeof window === "undefined") return initialFormState;
  return { ...initialFormState, draft: globalThis.localStorage.getItem(STORAGE_KEYS.draft) || "" };
}

function formReducer(state, action) {
  switch (action.type) {
    case "SET_DRAFT":
      return { ...state, draft: action.value };
    case "ADD_ATTACHMENTS":
      return { ...state, attachments: [...state.attachments, ...action.items] };
    case "REMOVE_ATTACHMENT":
      return { ...state, attachments: state.attachments.filter((a) => a.id !== action.id) };
    case "SEND_START":
      return { ...state, draft: "", attachments: [], isSending: true, streamingMessageId: action.messageId, streamingText: "" };
    case "SEND_END":
      return { ...state, isSending: false, streamingMessageId: "", streamingText: "" };
    case "SET_STREAMING_TEXT":
      return { ...state, streamingText: action.text };
    case "RESET_CHAT":
      return { ...state, draft: "", attachments: [], streamingMessageId: "", streamingText: "" };
    default:
      return state;
  }
}

function initDataState() {
  const empty = { providerGroups: [], loadingData: true, loadError: "", sessions: [], activeSelection: { sessionId: "", providerId: "", modelId: "" } };
  if (typeof window === "undefined") return empty;
  let sessions = [];
  try {
    const saved = safeParse(globalThis.localStorage.getItem(STORAGE_KEYS.sessions), []);
    sessions = Array.isArray(saved) ? saved.map((session) => ({
      ...session,
      messages: Array.isArray(session.messages) ? session.messages : [],
    })) : [];
  } catch { /* empty */ }
  return {
    ...empty,
    sessions,
    activeSelection: {
      sessionId: globalThis.localStorage.getItem(STORAGE_KEYS.activeSessionId) || "",
      providerId: globalThis.localStorage.getItem(STORAGE_KEYS.activeProviderId) || "",
      modelId: "",
    },
  };
}

function dataReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loadingData: true, loadError: "" };
    case "LOAD_SUCCESS":
      return {
        ...state,
        providerGroups: action.providerGroups,
        loadingData: false,
        loadError: action.providerGroups.length === 0 ? "Providers connected but no models available." : "",
      };
    case "LOAD_ERROR":
      return { ...state, loadError: action.error, providerGroups: [], loadingData: false };
    case "SET_LOAD_ERROR":
      return { ...state, loadError: action.error };
    case "SET_SESSIONS":
      return { ...state, sessions: action.sessions };
    case "PREPEND_SESSION":
      return { ...state, sessions: [action.session, ...state.sessions] };
    case "UPDATE_SESSION":
      return { ...state, sessions: state.sessions.map((s) => (s.id === action.sessionId ? action.updater(cloneSession(s)) : s)) };
    case "SET_ACTIVE_SELECTION":
      return { ...state, activeSelection: action.selection };
    case "UPDATE_ACTIVE_SELECTION":
      return { ...state, activeSelection: action.updater(state.activeSelection) };
    default:
      return state;
  }
}

// --- Sub-components ---

function ModelSelectorButton({ modelMenuRef, modelMenuOpen, onToggleMenu, modelLabel, modelSubLabel, providerGroups, selectedModelId, onSelectModel }) {
  return (
    <div ref={modelMenuRef} className="relative">
      <button
        type="button"
        onClick={onToggleMenu}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/8"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{modelLabel}</span>
            <span className="material-symbols-outlined text-[18px] text-white/70">expand_more</span>
          </div>
          <p className="truncate text-xs text-white/55">{modelSubLabel}</p>
        </div>
      </button>

      {modelMenuOpen ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-[20px] border border-white/10 bg-[#262626] shadow-2xl shadow-black/50">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/45">Models</p>
            <p className="text-sm text-white/75">Only from connected providers</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
            {providerGroups.map((group) => (
              <div key={group.providerId} className="mb-2 rounded-[16px] border border-white/10 bg-black/20 p-2">
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-sm font-semibold text-white">{group.providerName}</p>
                  <Badge size="sm" variant="default">{group.models.length}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.models.map((model) => {
                    const isActive = model.id === selectedModelId;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => onSelectModel(model.id)}
                        className={`rounded-[14px] border px-3 py-3 text-left transition ${isActive ? "border-blue-400/40 bg-blue-500/15" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{model.name}</p>
                            <p className="truncate text-xs text-white/45">{model.requestModel}</p>
                          </div>
                          {isActive ? <span className="material-symbols-outlined text-[18px] text-blue-300">check_circle</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatHistoryPanel({ historyMenuRef, sessionItems, effectiveSessionId, onSelectSession }) {
  return (
    <div ref={historyMenuRef} className="absolute right-4 top-[72px] z-20 w-[min(360px,calc(100vw-2rem))] rounded-[20px] border border-white/10 bg-[#262626] p-2 shadow-2xl shadow-black/50 lg:right-6">
      <div className="px-3 py-2">
        <p className="text-xs uppercase tracking-[0.22em] text-white/45">Recent chats</p>
      </div>
      <div className="max-h-[48vh] space-y-2 overflow-y-auto p-1 custom-scrollbar">
        {sessionItems.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/55">
            No conversations yet.
          </div>
        ) : sessionItems.map((session) => {
          const isActive = session.id === effectiveSessionId;
          const latestMessage = [...(session.messages || [])].reverse().find((message) => message.role === "user") || session.messages?.[0];
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
              className={`w-full rounded-[16px] border px-3 py-3 text-left transition ${isActive ? "border-blue-400/40 bg-blue-500/15" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{session.title}</p>
                  <p className="mt-1 truncate text-xs text-white/50">{textValue(latestMessage?.content) || "Empty chat"}</p>
                </div>
                <span className="text-xs text-white/40 shrink-0">{formatRelativeTime(session.updatedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageBubble({ message, streamingMessageId, streamingText, activeModelName }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isStreaming = isAssistant && message.id === streamingMessageId && message.status === "streaming";
  const content = textValue(message.content) || (isAssistant ? streamingText : "");

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}>
      <div className={`max-w-[min(88%,42rem)] ${isUser ? "rounded-3xl bg-[#2f2f2f] px-5 py-3.5 text-white" : "text-white/90"}`}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold">{isUser ? "You" : activeModelName || "Assistant"}</span>
        </div>

        {message.attachments?.length ? (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 mt-2">
            {message.attachments.map((attachment) => (
              <a key={attachment.id} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
                <Image src={attachment.dataUrl} alt={attachment.name} width={200} height={112} className="h-28 w-full object-cover" unoptimized />
              </a>
            ))}
          </div>
        ) : null}

        <div className="whitespace-pre-wrap break-words text-[15px] leading-7">
          {content}
          {isAssistant && isStreaming && !streamingText ? <span className="inline-block animate-pulse">▋</span> : null}
        </div>
      </div>
    </div>
  );
}

function ChatComposer({ attachments, onRemoveAttachment, draft, onDraftChange, onKeyDown, activeModel, loadingData, fileInputRef, onAttachFiles, isSending, onStop, onSend, canSend }) {
  return (
    <div className="shrink-0 pt-2">
      {attachments.length > 0 ? (
        <div className="mx-auto mb-3 flex w-full max-w-3xl flex-wrap gap-2 px-4">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-xs text-white/80 max-w-[12rem] truncate">{attachment.name}</span>
              <button type="button" onClick={() => onRemoveAttachment(attachment.id)} className="text-white/55 hover:text-white" aria-label="Remove attachment">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl px-4 pb-2">
        <div className="rounded-[26px] bg-[#2f2f2f] px-3 pt-3 pb-2 shadow-[0_0_15px_rgba(0,0,0,0.10)] ring-1 ring-white/5">
          <textarea
            suppressHydrationWarning
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message AI"
            aria-label="Message AI"
            rows={1}
            className="w-full resize-none bg-transparent px-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/40 custom-scrollbar max-h-[25vh] overflow-y-auto"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!activeModel || loadingData} className="p-2 text-white/50 hover:text-white transition rounded-full hover:bg-white/5">
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAttachFiles} aria-label="Attach files" />
              <span className="text-xs font-medium text-white/30 truncate max-w-[120px]">{activeModel ? activeModel.name : "No model"}</span>
            </div>

            <div className="flex items-center gap-2">
              {isSending ? (
                <button type="button" onClick={onStop} className="p-2 text-white bg-white/10 hover:bg-white/20 transition rounded-full h-8 w-8 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                </button>
              ) : null}
              <button type="button" onClick={onSend} disabled={!canSend} className={`h-8 w-8 rounded-full flex items-center justify-center transition ${canSend ? 'bg-white text-black hover:opacity-90' : 'bg-white/10 text-white/30 cursor-not-allowed'}`}>
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Hooks & extracted components ---

function useChatActions({ form, formDispatch, data, dataDispatch, modelIndex, activeProviderGroup, activeModel, effectiveSessionId, abortRef }) {
  const updateSession = (sessionId, updater) => {
    dataDispatch({ type: "UPDATE_SESSION", sessionId, updater });
  };

  const handleNewChat = () => {
    if (!activeModel) return;
    const session = ensureSessionForModel(activeModel);
    if (!session) return;
    dataDispatch({ type: "PREPEND_SESSION", session });
    dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: session.id, providerId: session.providerId, modelId: session.modelId } });
    formDispatch({ type: "RESET_CHAT" });
  };

  const handleSelectSession = (sessionId, closeHistory) => {
    const session = data.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    dataDispatch({
      type: "UPDATE_ACTIVE_SELECTION",
      updater: (prev) => ({
        sessionId,
        providerId: session.providerId || prev.providerId,
        modelId: session.modelId || prev.modelId,
      }),
    });
    closeHistory?.();
  };

  const handleDeleteCurrentChat = () => {
    if (!effectiveSessionId) return;
    const nextSessions = data.sessions.filter((session) => session.id !== effectiveSessionId);
    const fallback = nextSessions[0] || null;
    dataDispatch({ type: "SET_SESSIONS", sessions: nextSessions });
    dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: fallback
      ? { sessionId: fallback.id, providerId: fallback.providerId, modelId: fallback.modelId }
      : { sessionId: "", providerId: "", modelId: "" }
    });
  };

  const handleSelectProvider = (providerId) => {
    const group = data.providerGroups.find((item) => item.providerId === providerId);
    if (!group || group.models.length === 0) return;
    const nextModel = group.models[0];

    const current = data.sessions.find((session) => session.id === effectiveSessionId);
    if (current && current.messages.length > 0) {
      const session = ensureSessionForModel(nextModel);
      if (!session) return;
      dataDispatch({ type: "PREPEND_SESSION", session });
      dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: session.id, providerId: group.providerId, modelId: nextModel.id } });
    } else if (current) {
      dataDispatch({ type: "UPDATE_SESSION", sessionId: current.id, updater: (item) => ({
        ...item,
        providerId: group.providerId,
        providerName: group.providerName,
        modelId: nextModel.id,
        modelName: nextModel.name,
      }) });
      dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: current.id, providerId: group.providerId, modelId: nextModel.id } });
    } else {
      dataDispatch({ type: "UPDATE_ACTIVE_SELECTION", updater: (prev) => ({ ...prev, providerId: group.providerId, modelId: nextModel.id }) });
    }
  };

  const handleSelectModel = (modelId) => {
    const model = modelIndex.get(modelId);
    if (!model) return;

    const current = data.sessions.find((session) => session.id === effectiveSessionId);
    if (current && current.messages.length > 0) {
      const session = ensureSessionForModel(model);
      if (!session) return;
      dataDispatch({ type: "PREPEND_SESSION", session });
      dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: session.id, providerId: model.providerId, modelId: model.id } });
    } else if (current) {
      dataDispatch({ type: "UPDATE_SESSION", sessionId: current.id, updater: (item) => ({
        ...item,
        providerId: model.providerId,
        providerName: model.providerName,
        modelId: model.id,
        modelName: model.name,
      }) });
      dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: current.id, providerId: model.providerId, modelId: model.id } });
    } else {
      const session = ensureSessionForModel(model);
      if (!session) return;
      dataDispatch({ type: "PREPEND_SESSION", session });
      dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: { sessionId: session.id, providerId: model.providerId, modelId: model.id } });
    }
  };

  const handleAttachFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      event.target.value = "";
      return;
    }

    const converted = await Promise.all(images.map(async (file) => ({
      id: createId(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file),
    })));

    formDispatch({ type: "ADD_ATTACHMENTS", items: converted });
    event.target.value = "";
  };

  const removeAttachment = (attachmentId) => {
    formDispatch({ type: "REMOVE_ATTACHMENT", id: attachmentId });
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const finalizeSessionTitle = (sessionId, titleSeed) => {
    const title = makeSessionTitle(titleSeed);
    updateSession(sessionId, (session) => ({
      ...session,
      title: session.title === "New chat" ? title : session.title,
      updatedAt: new Date().toISOString(),
    }));
  };

  const sendMessage = async () => {
    const model = activeModel || activeProviderGroup?.models?.[0] || null;
    if (!model) return;

    const userText = form.draft.trim();
    if (!userText && form.attachments.length === 0) return;

    let sessionId = effectiveSessionId;
    let session = data.sessions.find((item) => item.id === sessionId);
    if (!session) {
      session = ensureSessionForModel(model);
      if (!session) return;
      sessionId = session.id;
      dataDispatch({ type: "PREPEND_SESSION", session });
      dataDispatch({ type: "UPDATE_ACTIVE_SELECTION", updater: (prev) => ({ ...prev, sessionId }) });
    }

    const userMessage = {
      id: createId(),
      role: "user",
      content: userText,
      attachments: form.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      })),
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = createId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "streaming",
    };

    const nextMessages = [...(session.messages || []), userMessage, assistantMessage];
    dataDispatch({ type: "UPDATE_SESSION", sessionId, updater: (item) => ({
      ...item,
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.name,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
      title: item.title === "New chat" ? makeSessionTitle(userText) : item.title,
    }) });
    formDispatch({ type: "SEND_START", messageId: assistantMessageId });
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const requestMessages = [];
    for (const message of nextMessages) {
      if (message.role === "assistant" && message.id === assistantMessageId) continue;
      requestMessages.push({ role: message.role, content: message.role === "user" ? buildUserContent(message) : message.content });
    }

    try {
      const response = await fetch("/api/dashboard/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: model.requestModel || model.id,
          messages: requestMessages,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(textValue(errorData.error || errorData.message || `Request failed (${response.status})`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const responseData = await response.json().catch(() => ({}));
        const fallbackText = textValue(responseData?.choices?.[0]?.message?.content || responseData?.output_text || responseData?.error || responseData?.message || "");
        updateSession(sessionId, (currentSession) => ({
          ...currentSession,
          messages: currentSession.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: fallbackText, status: "done" } : message)),
          updatedAt: new Date().toISOString(),
        }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) { // eslint-disable-line no-await-in-loop -- sequential: streaming chunks from reader
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const chunk = JSON.parse(payload);
            const text = readAssistantText(chunk);
            if (!text) continue;

            assistantText += text;
            formDispatch({ type: "SET_STREAMING_TEXT", text: assistantText });
            updateSession(sessionId, (currentSession) => ({
              ...currentSession,
              messages: currentSession.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: assistantText, status: "streaming" } : message)),
              updatedAt: new Date().toISOString(),
            }));
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      updateSession(sessionId, (currentSession) => ({
        ...currentSession,
        messages: currentSession.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: assistantText || message.content, status: "done" } : message)),
        updatedAt: new Date().toISOString(),
      }));
      finalizeSessionTitle(sessionId, userText);
    } catch (error) {
      if (error.name !== "AbortError") {
        const errorText = textValue(error?.message || error);
        updateSession(sessionId, (currentSession) => ({
          ...currentSession,
          messages: currentSession.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: message.content || `Error: ${errorText}`, status: "error" } : message)),
          updatedAt: new Date().toISOString(),
        }));
        dataDispatch({ type: "SET_LOAD_ERROR", error: errorText || "Failed to send message." });
      }
    } finally {
      formDispatch({ type: "SEND_END" });
      abortRef.current = null;
    }
  };

  return { handleNewChat, handleSelectSession, handleDeleteCurrentChat, handleSelectProvider, handleSelectModel, handleAttachFiles, removeAttachment, handleStop, sendMessage };
}

function EmptyChatState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
      <div className="max-w-xl space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 text-white/80">
          <span className="material-symbols-outlined text-[30px]">chat</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Start a conversation</h2>
          <p className="text-sm leading-6 text-white/60">
            Simple chat interface to interact with any AI model from connected providers. Select a model and start chatting!
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="mt-4 rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px]">error</span>
        <p className="text-sm leading-6">{error}</p>
      </div>
    </div>
  );
}

// --- Main component ---

function useProviderDataLoader(dataDispatch) {
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      dataDispatch({ type: "LOAD_START" });

      try {
        const providersRes = await fetch("/api/providers", { cache: "no-store", signal: controller.signal });
        const providersData = await providersRes.json().catch(() => ({}));
        const connections = Array.isArray(providersData.connections)
          ? providersData.connections.filter((connection) => connection?.isActive !== false)
          : [];

        if (connections.length === 0) {
          if (!controller.signal.aborted) {
            dataDispatch({ type: "LOAD_ERROR", error: "No providers connected yet." });
          }
          return;
        }

        const providerMap = new Map();

        for (const connection of connections) {
          const providerId = connection.provider || connection.id;
          const providerName = getProviderLabel(connection);
          const providerType = isOpenAICompatibleProvider(providerId)
            ? "openai-compatible"
            : isAnthropicCompatibleProvider(providerId)
              ? "anthropic-compatible"
              : providerId;

          if (!providerMap.has(providerId)) {
            providerMap.set(providerId, {
              providerId,
              providerName,
              providerType,
              connections: [],
              models: [],
            });
          }

          const group = providerMap.get(providerId);
          group.providerName = group.providerName || providerName;
          group.providerType = group.providerType || providerType;
          group.connections.push(connection);

          const staticModels = getModelsByProviderId(providerId)
            .flatMap((model) => { const m = normalizeStaticModel(model, connection); return m ? [m] : []; });
          group.models.push(...staticModels);
        }

        const liveResults = await Promise.all(
          connections.map(async (connection) => {
            try {
              const response = await fetch(`/api/providers/${connection.id}/models`, { cache: "no-store", signal: controller.signal });
              const responseData = await response.json().catch(() => ({}));
              if (!response.ok) return { connection, models: [] };
              const models = [];
              for (const model of parseProviderModelsPayload(responseData)) { const n = normalizeLiveModel(model, connection); if (n) models.push(n); }
              return { connection, models };
            } catch {
              return { connection, models: [] };
            }
          })
        );

        for (const result of liveResults) {
          const providerId = result.connection.provider || result.connection.id;
          const group = providerMap.get(providerId);
          if (!group) continue;
          group.models.push(...result.models);
        }

        const normalized = Array.from(providerMap.values())
          .flatMap((group) => {
            const models = dedupeModels(group.models).sort((a, b) => a.name.localeCompare(b.name));
            return models.length > 0 ? [{ ...group, models }] : [];
          })
          .sort((a, b) => a.providerName.localeCompare(b.providerName));

        if (!controller.signal.aborted) {
          dataDispatch({ type: "LOAD_SUCCESS", providerGroups: normalized });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          dataDispatch({ type: "LOAD_ERROR", error: textValue(error?.message) || "Failed to load providers/models." });
        }
      }
    }

    loadData();
    return () => {
      controller.abort();
    };
  }, [dataDispatch]);
}

export default function BasicChatPageClient() {
  const [form, formDispatch] = useReducer(formReducer, null, initFormState);
  const [data, dataDispatch] = useReducer(dataReducer, null, initDataState);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const initializedRef = useRef(false);
  const hasPersistedRef = useRef(false);
  const modelMenuRef = useRef(null);
  const historyMenuRef = useRef(null);

  useProviderDataLoader(dataDispatch);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setModelMenuOpen(false);
      }
      if (historyMenuRef.current && !historyMenuRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modelIndex = useMemo(() => {
    const map = new Map();
    for (const group of data.providerGroups) {
      for (const model of group.models) {
        map.set(model.id, {
          ...model,
          providerId: group.providerId,
          providerName: group.providerName,
        });
      }
    }
    return map;
  }, [data.providerGroups]);

  const activeProviderGroup = useMemo(() => {
    return data.providerGroups.find((group) => group.providerId === data.activeSelection.providerId) || data.providerGroups[0] || null;
  }, [data.providerGroups, data.activeSelection.providerId]);

  const effectiveSessionId = useMemo(() => {
    if (data.activeSelection.sessionId && data.sessions.some((s) => s.id === data.activeSelection.sessionId)) {
      return data.activeSelection.sessionId;
    }
    return data.sessions[0]?.id || "";
  }, [data.sessions, data.activeSelection.sessionId]);

  const activeModel = useMemo(() => {
    const direct = data.activeSelection.modelId ? modelIndex.get(data.activeSelection.modelId) : undefined;
    if (direct) return direct;
    if (effectiveSessionId) {
      const session = data.sessions.find((item) => item.id === effectiveSessionId);
      if (session?.modelId && modelIndex.has(session.modelId)) return modelIndex.get(session.modelId);
    }
    return activeProviderGroup?.models?.[0] || null;
  }, [data.activeSelection.modelId, modelIndex, activeProviderGroup, data.sessions, effectiveSessionId]);

  const currentSession = useMemo(() => data.sessions.find((session) => session.id === effectiveSessionId) || null, [data.sessions, effectiveSessionId]);
  const currentMessages = currentSession?.messages || [];
  const sessionItems = useMemo(() => data.sessions.toSorted((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [data.sessions]);
  const canSend = !form.isSending && !!activeModel && (form.draft.trim().length > 0 || form.attachments.length > 0);

  useEffect(() => {
    if (!hasPersistedRef.current) { hasPersistedRef.current = true; return; }
    try {
      globalThis.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(data.sessions));
      globalThis.localStorage.setItem(STORAGE_KEYS.activeSessionId, data.activeSelection.sessionId);
      globalThis.localStorage.setItem(STORAGE_KEYS.activeProviderId, data.activeSelection.providerId);
      globalThis.localStorage.setItem(STORAGE_KEYS.draft, form.draft);
    } catch {
      // Ignore storage errors.
    }
  }, [data.sessions, data.activeSelection.sessionId, data.activeSelection.providerId, form.draft]);

  useEffect(() => {
    if (data.loadingData || initializedRef.current) return;
    if (data.providerGroups.length === 0) return;
    initializedRef.current = true;

    if (data.sessions.length > 0) return;

    const savedProvider = data.providerGroups.find((group) => group.providerId === data.activeSelection.providerId) || data.providerGroups[0];
    const savedModel = (data.activeSelection.modelId ? modelIndex.get(data.activeSelection.modelId) : undefined)
      || savedProvider.models[0];

    const session = {
      id: createId(),
      title: "New chat",
      providerId: savedProvider.providerId,
      providerName: savedProvider.providerName,
      modelId: savedModel.id,
      modelName: savedModel.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    const nextSelection = { sessionId: session.id, providerId: savedProvider.providerId, modelId: savedModel.id };
    dataDispatch({ type: "SET_SESSIONS", sessions: [session] });
    dataDispatch({ type: "SET_ACTIVE_SELECTION", selection: nextSelection });

    try {
      globalThis.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify([session]));
      globalThis.localStorage.setItem(STORAGE_KEYS.activeSessionId, nextSelection.sessionId);
      globalThis.localStorage.setItem(STORAGE_KEYS.activeProviderId, nextSelection.providerId);
    } catch { /* Ignore storage errors. */ }
  }, [data.loadingData, data.providerGroups, data.sessions, data.activeSelection, modelIndex]);

  const { handleSelectSession, handleDeleteCurrentChat, handleSelectModel, handleAttachFiles, removeAttachment, handleStop, sendMessage } =
    useChatActions({ form, formDispatch, data, dataDispatch, modelIndex, activeProviderGroup, activeModel, effectiveSessionId, abortRef });

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) sendMessage();
    }
  };

  const modelLabel = activeModel ? `${activeModel.name}` : "Select model";
  const modelSubLabel = activeModel ? activeModel.requestModel : "Choose from connected providers";

  return (
    <div className="relative flex-1 flex flex-col h-full min-h-0 min-w-0 bg-[#212121] text-white overflow-hidden">
      <div className="relative mx-auto flex flex-1 h-full min-h-0 w-full max-w-4xl flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <ModelSelectorButton
            modelMenuRef={modelMenuRef}
            modelMenuOpen={modelMenuOpen}
            onToggleMenu={() => setModelMenuOpen((value) => !value)}
            modelLabel={modelLabel}
            modelSubLabel={modelSubLabel}
            providerGroups={data.providerGroups}
            selectedModelId={data.activeSelection.modelId}
            onSelectModel={handleSelectModel}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/8"
            >
              History
            </button>
            <Button variant="ghost" size="sm" icon="delete" onClick={handleDeleteCurrentChat} disabled={!effectiveSessionId || data.sessions.length === 0}>
              Clear
            </Button>
          </div>
        </div>

        {historyOpen ? (
          <ChatHistoryPanel
            historyMenuRef={historyMenuRef}
            sessionItems={sessionItems}
            effectiveSessionId={effectiveSessionId}
            onSelectSession={(id) => handleSelectSession(id, () => setHistoryOpen(false))}
          />
        ) : null}

        <ChatErrorBanner error={data.loadError} />

        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
            {currentMessages.length === 0 ? <EmptyChatState /> : null}

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4">
              {currentMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streamingMessageId={form.streamingMessageId}
                  streamingText={form.streamingText}
                  activeModelName={activeModel?.name}
                />
              ))}
            </div>
          </div>

          <ChatComposer
            attachments={form.attachments}
            onRemoveAttachment={removeAttachment}
            draft={form.draft}
            onDraftChange={(value) => formDispatch({ type: "SET_DRAFT", value })}
            onKeyDown={handleKeyDown}
            activeModel={activeModel}
            loadingData={data.loadingData}
            fileInputRef={fileInputRef}
            onAttachFiles={handleAttachFiles}
            isSending={form.isSending}
            onStop={handleStop}
            onSend={sendMessage}
            canSend={canSend}
          />

          <p className="mx-auto mt-2 max-w-3xl px-4 pb-4 text-center text-xs text-white/30">
            Model list is filtered from connected providers.
          </p>
        </div>
      </div>
    </div>
  );
}
