"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, Button, Badge, Input, Modal, CardSkeleton, OAuthModal, KiroOAuthWrapper, CursorAuthModal, IFlowCookieModal, GitLabAuthModal, Toggle, Select, EditConnectionModal, NoAuthProxyCard, ConfirmModal } from "@/shared/components";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, FREE_PROVIDERS, FREE_TIER_PROVIDERS, WEB_COOKIE_PROVIDERS, getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS, THINKING_CONFIG } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { translate } from "@/i18n/runtime";
import { fetchSuggestedModels } from "@/shared/utils/providerModelsFetcher";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import ModelRow from "./ModelRow";
import PassthroughModelsSection from "./PassthroughModelsSection";
import CompatibleModelsSection from "./CompatibleModelsSection";
import ConnectionRow from "./ConnectionRow";
import AddApiKeyModal from "./AddApiKeyModal";
import EditCompatibleNodeModal from "./EditCompatibleNodeModal";
import AddCustomModelModal from "./AddCustomModelModal";
import BulkImportCodexModal from "./BulkImportCodexModal";

const ONE_BY_ONE_DELAY_MS = 1000;

const AUTO_PING_SETTINGS_KEYS = {
  claude: "claudeAutoPing",
  codex: "codexAutoPing",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaderIconPath(providerInfo, isOpenAICompatible, isAnthropicCompatible) {
  if (isOpenAICompatible && providerInfo.apiType) {
    return providerInfo.apiType === "responses" ? "/providers/oai-r.png" : "/providers/oai-cc.png";
  }
  if (isAnthropicCompatible) return "/providers/anthropic-m.png";
  return `/providers/${providerInfo.id}.png`;
}

function ProviderHeader({ providerInfo, isOpenAICompatible, isAnthropicCompatible, connectionCount }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="min-w-0">
      <Link
        href="/dashboard/providers"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        Back to Providers
      </Link>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${providerInfo.color}15` }}
        >
          {imgError ? (
            <span className="text-sm font-bold" style={{ color: providerInfo.color }}>
              {providerInfo.textIcon || providerInfo.id.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <Image
              src={getHeaderIconPath(providerInfo, isOpenAICompatible, isAnthropicCompatible)}
              alt={providerInfo.name}
              width={48}
              height={48}
              className="max-h-12 max-w-12 rounded-lg object-contain"
              sizes="48px"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{providerInfo.name}</h1>
            {(providerInfo.notice?.apiKeyUrl || providerInfo.notice?.signupUrl || providerInfo.website) && (
              <a
                href={providerInfo.notice?.apiKeyUrl || providerInfo.notice?.signupUrl || providerInfo.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                {providerInfo.notice?.apiKeyUrl ? "Get API Key" : "Sign up / Learn more"}
              </a>
            )}
          </div>
          <p className="text-text-muted">
            {connectionCount} connection{connectionCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProviderNotices({ providerInfo }) {
  return (
    <>
      {providerInfo.deprecated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <span className="material-symbols-outlined text-[16px] text-yellow-500 mt-0.5 shrink-0">warning</span>
          <p className="text-xs text-red-600 dark:text-yellow-400 leading-relaxed">{providerInfo.deprecationNotice}</p>
        </div>
      )}
      {providerInfo.notice?.text && !providerInfo.deprecated && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 sm:flex-row sm:items-center">
          <span className="material-symbols-outlined text-[16px] text-blue-500 shrink-0">info</span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-blue-600 dark:text-blue-400">{providerInfo.notice.text}</p>
          {providerInfo.notice.apiKeyUrl && (
            <a
              href={providerInfo.notice.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 sm:py-0.5"
            >
              Get API Key →
            </a>
          )}
        </div>
      )}
    </>
  );
}

function CompatibleNodeDetailsCard({ isAnthropicCompatible, providerNode, providerId, onEdit, onDelete, onAddKey }) {
  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{isAnthropicCompatible ? "Anthropic Compatible Details" : "OpenAI Compatible Details"}</h2>
          <p className="break-all text-sm text-text-muted">
            {isAnthropicCompatible ? "Messages API" : (providerNode.apiType === "responses" ? "Responses API" : "Chat Completions")} · {(providerNode.baseUrl || "").replace(/\/$/, "")}/
            {isAnthropicCompatible ? "messages" : (providerNode.apiType === "responses" ? "responses" : "chat/completions")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
          <Button size="sm" icon="add" onClick={onAddKey} className="w-full sm:w-auto">
            Add API Key
          </Button>
          <Button size="sm" variant="secondary" icon="edit" onClick={onEdit} className="w-full sm:w-auto">
            Edit
          </Button>
          <Button size="sm" variant="secondary" icon="delete" onClick={onDelete} className="w-full sm:w-auto">
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OneByOneSummaryBar({ summary, isRunning, currentConnectionId, connections }) {
  if (!summary) return null;
  return (
    <div className="mb-4 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-3">
        <span>Total: {summary.total}</span>
        <span>Completed: {summary.completed}</span>
        <span>Passed: {summary.passed}</span>
        <span>Failed: {summary.failed}</span>
        {summary.stopped && (
          <span className="text-amber-600 dark:text-amber-400">Stopped</span>
        )}
        {isRunning && currentConnectionId && (
          <span>Running: {connections.find((conn) => conn.id === currentConnectionId)?.name || currentConnectionId}</span>
        )}
      </div>
    </div>
  );
}

function modalReducer(state, action) {
  switch (action.type) {
    case "OPEN":
      return { ...state, [action.modal]: true, ...(action.modal === "showAddApiKeyModal" ? { addConnectionError: "" } : {}) };
    case "CLOSE":
      return { ...state, [action.modal]: false, ...(action.modal === "showAddApiKeyModal" ? { addConnectionError: "" } : {}) };
    case "SET_ERROR":
      return { ...state, addConnectionError: action.value };
    default:
      return state;
  }
}

function oneByOneReducer(state, action) {
  switch (action.type) {
    case "START":
      return { ...state, running: true, stopping: false, currentConnectionId: null, results: action.results, summary: action.summary };
    case "SET_CURRENT":
      return { ...state, currentConnectionId: action.id };
    case "SET_RESULT":
      return { ...state, results: { ...state.results, [action.id]: action.result } };
    case "SET_SUMMARY":
      return { ...state, summary: action.summary };
    case "STOPPING":
      return { ...state, stopping: true };
    case "FINISH":
      return { ...state, currentConnectionId: null, running: false, stopping: false };
    default:
      return state;
  }
}

const initialModalState = {
  showOAuthModal: false,
  showIFlowCookieModal: false,
  showAddApiKeyModal: false,
  addConnectionError: "",
  showBulkImportCodex: false,
  showEditModal: false,
  showEditNodeModal: false,
  showBulkProxyModal: false,
  showAddCustomModel: false,
  showAgRiskModal: false,
};

const initialOneByOneState = {
  running: false,
  stopping: false,
  currentConnectionId: null,
  results: {},
  summary: null,
};

function providerReducer(state, action) {
  const v = action.value;
  switch (action.type) {
    case 'setConnections': return { ...state, connections: typeof v === 'function' ? v(state.connections) : v };
    case 'setLoading': return { ...state, loading: v };
    case 'setProviderNode': return { ...state, providerNode: v };
    case 'setProxyPools': return { ...state, proxyPools: v };
    case 'setSelectedConnection': return { ...state, selectedConnection: v };
    case 'setModelAliases': return { ...state, modelAliases: v };
    case 'setCustomModels': return { ...state, customModels: v };
    case 'setModelTestResults': return { ...state, modelTestResults: typeof v === 'function' ? v(state.modelTestResults) : v };
    case 'setModelsTestError': return { ...state, modelsTestError: v };
    case 'setTestingModelIds': return { ...state, testingModelIds: typeof v === 'function' ? v(state.testingModelIds) : v };
    case 'setSelectedConnectionIds': return { ...state, selectedConnectionIds: typeof v === 'function' ? v(state.selectedConnectionIds) : v };
    case 'setBulkUpdatingProxy': return { ...state, bulkUpdatingProxy: v };
    case 'setProviderStrategy': return { ...state, providerStrategy: v };
    case 'setProviderStickyLimit': return { ...state, providerStickyLimit: v };
    case 'setAutoPing': return { ...state, autoPing: v };
    case 'setSuggestedModels': return { ...state, suggestedModels: v };
    case 'setKiloFreeModels': return { ...state, kiloFreeModels: v };
    case 'setDisabledModelIds': return { ...state, disabledModelIds: v };
    case 'setConfirmState': return { ...state, confirmState: v };
    case 'setImportingQoderModels': return { ...state, importingQoderModels: v };
    default: return state;
  }
}

function ConnectionsList({ connections, setConnections, isSelected, toggleSelectConnection, proxyPools, isOAuth, providerId, autoPing, handleAutoPingConnection, oneByOneResults, handleSwapPriority, handleUpdateConnectionStatus, setSelectedConnection, setShowEditModal, handleDelete }) {
  return (
    <div className="flex min-w-0 flex-col divide-y divide-black/[0.03] dark:divide-white/[0.03]">
      {connections
        .map((conn, index) => (
          <div key={conn.id} className="flex min-w-0 items-stretch">
            <div className="flex shrink-0 items-center pl-1 sm:pl-2">
              <input
                type="checkbox"
                checked={isSelected(conn.id)}
                onChange={() => toggleSelectConnection(conn.id)}
                aria-label={`Select connection ${index + 1}`}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <ConnectionRow
                connection={conn}
                proxyPools={proxyPools}
                isOAuth={isOAuth}
                isFirst={index === 0}
                isLast={index === connections.length - 1}
                onMoveUp={() => handleSwapPriority(index, index - 1)}
                onMoveDown={() => handleSwapPriority(index, index + 1)}
                onToggleActive={(isActive) => handleUpdateConnectionStatus(conn.id, isActive)}
                autoPing={AUTO_PING_SETTINGS_KEYS[providerId] && conn.authType === "oauth" ? {
                  on: autoPing.connections[conn.id] === true,
                  onToggle: (on) => handleAutoPingConnection(conn.id, on),
                  provider: providerId,
                } : null}
                onUpdateProxy={async (proxyPoolId) => {
                  try {
                    const res = await fetch(`/api/providers/${conn.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ proxyPoolId: proxyPoolId || null }),
                    });
                    if (res.ok) {
                      setConnections(prev => prev.map(c =>
                        c.id === conn.id
                          ? { ...c, providerSpecificData: { ...c.providerSpecificData, proxyPoolId: proxyPoolId || null } }
                          : c
                      ));
                    }
                  } catch (error) {
                    console.log("Error updating proxy:", error);
                  }
                }}
                onEdit={() => {
                  setSelectedConnection(conn);
                  setShowEditModal(true);
                }}
                onDelete={() => handleDelete(conn.id)}
                oneByOneStatus={oneByOneResults[conn.id] || null}
              />
            </div>
          </div>
        ))}
    </div>
  );
}

function BulkProxyModal({ isOpen, onClose, connections, proxyPools, bulkUpdatingProxy, onApplySinglePool, onApplyOneToOne }) {
  const activePools = proxyPools.filter((p) => p.isActive === true);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Apply Proxy (${connections.length} connections)`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onApplyOneToOne}
            disabled={bulkUpdatingProxy || activePools.length === 0}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">sync_alt</span>
            <span className="text-sm text-text-main">One-to-one (rotate)</span>
          </button>
          <button
            type="button"
            onClick={() => onApplySinglePool(null)}
            disabled={bulkUpdatingProxy}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">link_off</span>
            <span className="text-sm text-text-main">None (unbind all)</span>
          </button>
          {proxyPools.map((pool) => (
            <button
              type="button"
              key={pool.id}
              onClick={() => onApplySinglePool(pool.id)}
              disabled={bulkUpdatingProxy || pool.isActive !== true}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-text-muted text-[18px]">lan</span>
              <span className="truncate text-sm text-text-main">{pool.name}</span>
              {pool.isActive !== true && (
                <span className="text-[10px] text-text-muted">(inactive)</span>
              )}
            </button>
          ))}
        </div>

        {bulkUpdatingProxy && <p className="text-xs text-text-muted">Applying...</p>}

        <Button onClick={onClose} variant="ghost" fullWidth disabled={bulkUpdatingProxy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function ModelsSection({
  isCompatible,
  providerStorageAlias,
  providerDisplayAlias,
  modelAliases,
  customModels,
  copied,
  onCopy,
  connections,
  isAnthropicCompatible,
  models,
  kiloFreeModels,
  disabledModelIds,
  modelTestResults,
  testingModelIds,
  isFreeNoAuth,
  providerId,
  importingQoderModels,
  suggestedModels,
  getCaps,
  modalDispatch,
  onSetAlias,
  onDeleteAlias,
  onAddCustomModel,
  onDeleteCustomModel,
  onTestModel,
  onImportQoderModels,
  onDisableModel,
  onEnableModel,
}) {
  if (isCompatible) {
    return (
      <CompatibleModelsSection
        providerStorageAlias={providerStorageAlias}
        providerDisplayAlias={providerDisplayAlias}
        modelAliases={modelAliases}
        customModels={customModels}
        copied={copied}
        onCopy={onCopy}
        onSetAlias={onSetAlias}
        onDeleteAlias={onDeleteAlias}
        onAddCustomModel={(modelId) => onAddCustomModel(modelId, "llm", providerStorageAlias)}
        onDeleteCustomModel={(modelId) => onDeleteCustomModel(modelId, "llm", providerStorageAlias)}
        connections={connections}
        isAnthropic={isAnthropicCompatible}
      />
    );
  }
  // Combine hardcoded models with Kilo free models (deduplicated)
  // Exclude non-llm models (embedding, tts, etc.) — they have dedicated pages under media-providers
  const allModels = [
    ...models,
    ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
  ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; });
  const disabledSet = new Set(disabledModelIds);
  const displayModels = allModels.filter((m) => !disabledSet.has(m.id));
  const disabledDisplayModels = allModels.filter((m) => disabledSet.has(m.id));
  const customModelRows = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias: providerStorageAlias,
    builtInModels: models,
    type: "llm",
  });

  return (
    <div className="flex flex-wrap gap-3">
      {/* Custom models first */}
      {customModelRows.map((model) => (
        <ModelRow
          key={`${model.source}-${model.fullModel}`}
          model={{ id: model.id, name: model.name }}
          fullModel={`${providerDisplayAlias}/${model.id}`}
          alias={model.alias}
          copied={copied}
          onCopy={onCopy}
          onSetAlias={() => {}}
          onDeleteAlias={() => {
            if (model.source === "custom") {
              onDeleteCustomModel(model.id, "llm", providerStorageAlias);
            } else {
              onDeleteAlias(model.alias);
            }
          }}
          testStatus={modelTestResults[model.id]}
          onTest={connections.length > 0 || isFreeNoAuth ? () => onTestModel(model.id) : undefined}
          isTesting={testingModelIds.has(model.id)}
          isCustom
          isFree={false}
          caps={getCaps(`${providerId}/${model.id}`)}
        />
      ))}

      {displayModels.map((model) => {
        const fullModel = `${providerStorageAlias}/${model.id}`;
        const oldFormatModel = `${providerId}/${model.id}`;
        const existingAlias = Object.entries(modelAliases).find(
          ([, m]) => m === fullModel || m === oldFormatModel
        )?.[0];
        return (
          <ModelRow
            key={model.id}
            model={model}
            fullModel={`${providerDisplayAlias}/${model.id}`}
            alias={existingAlias}
            copied={copied}
            onCopy={onCopy}
            onSetAlias={(alias) => onSetAlias(model.id, alias, providerStorageAlias)}
            onDeleteAlias={() => onDeleteAlias(existingAlias)}
            testStatus={modelTestResults[model.id]}
            onTest={connections.length > 0 || isFreeNoAuth ? () => onTestModel(model.id) : undefined}
            isTesting={testingModelIds.has(model.id)}
            isFree={model.isFree}
            onDisable={() => onDisableModel(model.id)}
            caps={getCaps(`${providerId}/${model.id}`)}
          />
        );
      })}

      {/* Add model button — inline, same style as model chips */}
      <button
        type="button"
        onClick={() => modalDispatch({ type: "OPEN", modal: "showAddCustomModel" })}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5 sm:w-auto"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Add Model
      </button>

      {/* Import Qoder models button — only show for qoder provider */}
      {providerId === "qoder" && connections.some((conn) => conn.isActive !== false) && (
        <button
          type="button"
          onClick={onImportQoderModels}
          disabled={importingQoderModels}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-500/40 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 transition-colors hover:border-blue-500 hover:bg-blue-500/5 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm" style={importingQoderModels ? { animation: "spin 1s linear infinite" } : undefined}>
            {importingQoderModels ? "progress_activity" : "download"}
          </span>
          {importingQoderModels ? translate("Fetching...") : translate("Fetch Qoder Models")}
        </button>
      )}

      {/* Suggested models from provider API — show only models not yet added */}
      {suggestedModels.length > 0 && (() => {
        const addedFullModels = new Set([
          ...Object.values(modelAliases),
          ...customModelRows.map((model) => model.fullModel),
        ]);
        const hardcodedIds = new Set(models.map((m) => m.id));
        const notAdded = suggestedModels.filter(
          (m) => !addedFullModels.has(`${providerStorageAlias}/${m.id}`) && !hardcodedIds.has(m.id)
        );
        if (notAdded.length === 0) return null;
        return (
          <div className="w-full mt-2">
            <p className="text-xs text-text-muted mb-2">Suggested free models (≥200k context):</p>
            <div className="flex flex-wrap gap-2">
              {notAdded.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={async () => {
                    await onAddCustomModel(m.id, "llm", providerStorageAlias);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  title={`${m.name} · ${(m.contextLength / 1000).toFixed(0)}k ctx`}
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  {m.id.split("/").pop()}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Disabled models — restorable */}
      {disabledDisplayModels.length > 0 && (
        <div className="w-full mt-2">
          <p className="text-xs text-text-muted mb-2">Disabled models ({disabledDisplayModels.length}):</p>
          <div className="flex flex-wrap gap-2">
            {disabledDisplayModels.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => onEnableModel(m.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                title="Restore model"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
                {m.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderModals({
  providerId,
  modals,
  modalDispatch,
  providerInfo,
  selectedConnection,
  proxyPools,
  isCompatible,
  isAnthropicCompatible,
  providerNode,
  providerStorageAlias,
  providerDisplayAlias,
  confirmState,
  onOAuthSuccess,
  onIFlowCookieSuccess,
  onSaveApiKey,
  onUpdateConnection,
  onUpdateNode,
  onAgRiskConfirm,
  onFetchConnections,
  onAddCustomModel,
  onCloseConfirm,
}) {
  return (
    <>
      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={modals.showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={onOAuthSuccess}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showOAuthModal" })}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={modals.showOAuthModal}
          onSuccess={onOAuthSuccess}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showOAuthModal" })}
        />
      ) : providerId === "gitlab" ? (
        <GitLabAuthModal
          isOpen={modals.showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={onOAuthSuccess}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showOAuthModal" })}
        />
      ) : (
        <OAuthModal
          isOpen={modals.showOAuthModal}
          provider={providerId}
          providerInfo={providerInfo}
          onSuccess={onOAuthSuccess}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showOAuthModal" })}
        />
      )}
      {providerId === "iflow" && (
        <IFlowCookieModal
          isOpen={modals.showIFlowCookieModal}
          onSuccess={onIFlowCookieSuccess}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showIFlowCookieModal" })}
        />
      )}
      <AddApiKeyModal
        isOpen={modals.showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo.name}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicCompatible}
        authType={providerInfo?.authType}
        authHint={providerInfo?.authHint}
        website={providerInfo?.website}
        proxyPools={proxyPools}
        error={modals.addConnectionError}
        onSave={onSaveApiKey}
        onBulkDone={onFetchConnections}
        onClose={() => modalDispatch({ type: "CLOSE", modal: "showAddApiKeyModal" })}
      />
      <EditConnectionModal
        isOpen={modals.showEditModal}
        connection={selectedConnection}
        proxyPools={proxyPools}
        onSave={onUpdateConnection}
        onClose={() => modalDispatch({ type: "CLOSE", modal: "showEditModal" })}
      />
      {isCompatible && (
        <EditCompatibleNodeModal
          isOpen={modals.showEditNodeModal}
          node={providerNode}
          onSave={onUpdateNode}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showEditNodeModal" })}
          isAnthropic={isAnthropicCompatible}
        />
      )}
      {!isCompatible && (
        <AddCustomModelModal
          isOpen={modals.showAddCustomModel}
          providerAlias={providerStorageAlias}
          providerDisplayAlias={providerDisplayAlias}
          onSave={async (modelId) => {
            await onAddCustomModel(modelId, "llm", providerStorageAlias);
            modalDispatch({ type: "CLOSE", modal: "showAddCustomModel" });
          }}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showAddCustomModel" })}
        />
      )}

      {providerId === "codex" && (
        <BulkImportCodexModal
          isOpen={modals.showBulkImportCodex}
          onClose={() => modalDispatch({ type: "CLOSE", modal: "showBulkImportCodex" })}
          onSuccess={onFetchConnections}
        />
      )}

      {/* AG Risk Confirmation Modal */}
      <ConfirmModal
        isOpen={modals.showAgRiskModal}
        onClose={() => modalDispatch({ type: "CLOSE", modal: "showAgRiskModal" })}
        onConfirm={onAgRiskConfirm}
        title="Risk Notice"
        message={providerInfo?.deprecationNotice}
        confirmText="I Understand, Continue"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={onCloseConfirm}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </>
  );
}

function ConnectionsCard({
  providerId, isCompatible, isOAuth, isFreeNoAuth, hasDualAuthModes,
  oauthConnectionLabel, apiKeyConnectionLabel,
  connections, proxyPools, selectedConnectionIds, oneByOne,
  providerStrategy, providerStickyLimit, autoPing,
  allSelected, isSelected, toggleSelectConnection, toggleSelectAllConnections,
  handleBulkDelete, handleRunOneByOneTest, handleStopOneByOneTest,
  triggerOAuthConnection, triggerApiKeyConnection, triggerAddConnection,
  handleRoundRobinToggle, handleStickyLimitChange,
  handleSwapPriority, handleUpdateConnectionStatus,
  handleAutoPingConnection, handleDelete,
  dispatch, modalDispatch,
}) {
  if (isFreeNoAuth) {
    return <NoAuthProxyCard providerId={providerId} />;
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Connections</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {connections.length > 0 && proxyPools.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon="lan"
              onClick={() => modalDispatch({ type: "OPEN", modal: "showBulkProxyModal" })}
            >
              Apply Proxy
            </Button>
          )}
          {connections.length > 0 && (
            <>
              {selectedConnectionIds.length > 0 && (
                <Button
                  size="sm"
                  variant="danger"
                  icon="delete"
                  onClick={handleBulkDelete}
                >
                  Delete Selected ({selectedConnectionIds.length})
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon="sync"
                onClick={handleRunOneByOneTest}
                disabled={oneByOne.running}
              >
                {oneByOne.running ? "Testing Connection One-by-One..." : "Test Connection One-by-One"}
              </Button>
              {oneByOne.running && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="stop"
                  onClick={handleStopOneByOneTest}
                  disabled={oneByOne.stopping}
                >
                  {oneByOne.stopping ? "Stopping..." : "Stop"}
                </Button>
              )}
            </>
          )}
          {/* Thinking config */}
          {/* Round Robin toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted font-medium">Round Robin</span>
            <Toggle
              checked={providerStrategy === "round-robin"}
              onChange={handleRoundRobinToggle}
            />
            {providerStrategy === "round-robin" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">Sticky:</span>
                <input
                  type="number"
                  min={1}
                  value={providerStickyLimit}
                  onChange={(e) => handleStickyLimitChange(e.target.value)}
                  placeholder="1"
                  aria-label="Sticky session limit"
                  className="w-14 px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {connections.length === 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
              <span className="material-symbols-outlined text-[18px]">{isOAuth ? "lock" : "key"}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-text-muted">No connections yet</p>
              {hasDualAuthModes && (
                <p className="text-xs text-text-muted">
                  Choose {oauthConnectionLabel} or {apiKeyConnectionLabel}.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {hasDualAuthModes ? (
              <>
                <Button size="sm" icon="lock" variant="secondary" onClick={triggerOAuthConnection}>
                  {oauthConnectionLabel}
                </Button>
                <Button size="sm" icon="key" onClick={triggerApiKeyConnection}>
                  {apiKeyConnectionLabel}
                </Button>
              </>
            ) : (
              <>
                {!isCompatible && providerId === "iflow" && (
                  <Button size="sm" icon="cookie" variant="secondary" onClick={() => modalDispatch({ type: "OPEN", modal: "showIFlowCookieModal" })}>
                    Cookie
                  </Button>
                )}
                {providerId === "codex" && (
                  <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => modalDispatch({ type: "OPEN", modal: "showBulkImportCodex" })}>
                    {translate("Bulk Add")}
                  </Button>
                )}
                <Button
                  size="sm"
                  icon="add"
                  onClick={triggerAddConnection}
                >
                  {isCompatible ? "Add API Key" : (providerId === "iflow" ? "OAuth" : "Add Connection")}
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <OneByOneSummaryBar
            summary={oneByOne.summary}
            isRunning={oneByOne.running}
            currentConnectionId={oneByOne.currentConnectionId}
            connections={connections}
          />
          {connections.length > 0 && (
            <div className="mb-3 flex items-center gap-2 border-b border-black/[0.03] pb-2 dark:border-white/[0.03]">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-muted hover:text-primary">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAllConnections}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Select All
              </label>
            </div>
          )}
          <ConnectionsList
            connections={connections}
            setConnections={(value) => dispatch({ type: 'setConnections', value })}
            isSelected={isSelected}
            toggleSelectConnection={toggleSelectConnection}
            proxyPools={proxyPools}
            isOAuth={isOAuth}
            providerId={providerId}
            autoPing={autoPing}
            handleAutoPingConnection={handleAutoPingConnection}
            oneByOneResults={oneByOne.results}
            handleSwapPriority={handleSwapPriority}
            handleUpdateConnectionStatus={handleUpdateConnectionStatus}
            setSelectedConnection={(value) => dispatch({ type: 'setSelectedConnection', value })}
            setShowEditModal={(val) => modalDispatch({ type: val ? "OPEN" : "CLOSE", modal: "showEditModal" })}
            handleDelete={handleDelete}
          />
          {!isCompatible && (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:flex">
              {providerId === "iflow" && (
                <Button
                  size="sm"
                  icon="cookie"
                  variant="secondary"
                  onClick={() => modalDispatch({ type: "OPEN", modal: "showIFlowCookieModal" })}
                  title="Add connection using browser cookie"
                  className="w-full sm:w-auto"
                >
                  Cookie
                </Button>
              )}
              {providerId === "codex" && (
                <Button
                  size="sm"
                  icon="playlist_add"
                  variant="secondary"
                  onClick={() => modalDispatch({ type: "OPEN", modal: "showBulkImportCodex" })}
                  title={translate("Bulk import codex accounts from JSON")}
                  className="w-full sm:w-auto"
                >
                  {translate("Bulk Add")}
                </Button>
              )}
              {hasDualAuthModes ? (
                <>
                  <Button
                    size="sm"
                    icon="lock"
                    variant="secondary"
                    onClick={triggerOAuthConnection}
                    className="w-full sm:w-auto"
                  >
                    {oauthConnectionLabel}
                  </Button>
                  <Button
                    size="sm"
                    icon="key"
                    onClick={triggerApiKeyConnection}
                    className="w-full sm:w-auto"
                  >
                    {apiKeyConnectionLabel}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  icon="add"
                  onClick={triggerAddConnection}
                  className="w-full sm:w-auto"
                >
                  Add
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function useProviderActions({ initialSettings, initialConnections, initialProviderNode, initialProxyPools }) {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id;
  const { getCaps } = useModelCaps();
  const [modals, modalDispatch] = useReducer(modalReducer, initialModalState);
  const [oneByOne, oneByOneDispatch] = useReducer(oneByOneReducer, initialOneByOneState);
  const [state, dispatch] = useReducer(providerReducer, {
    connections: initialConnections,
    loading: false,
    providerNode: initialProviderNode,
    proxyPools: initialProxyPools,
    selectedConnection: null,
    modelAliases: {},
    customModels: [],
    modelTestResults: {},
    modelsTestError: "",
    testingModelIds: new Set(),
    selectedConnectionIds: [],
    bulkUpdatingProxy: false,
    providerStrategy: (initialSettings?.providerStrategies || {})[providerId]?.fallbackStrategy || null,
    providerStickyLimit: (initialSettings?.providerStrategies || {})[providerId]?.stickyRoundRobinLimit != null
      ? String((initialSettings?.providerStrategies || {})[providerId]?.stickyRoundRobinLimit)
      : "1",
    autoPing: (() => {
      const autoPingSettingsKey = AUTO_PING_SETTINGS_KEYS[providerId];
      const apCfg = autoPingSettingsKey ? (initialSettings?.[autoPingSettingsKey] || {}) : {};
      return { enabled: apCfg.enabled === true, connections: apCfg.connections || {} };
    })(),
    suggestedModels: [],
    kiloFreeModels: [],
    disabledModelIds: [],
    confirmState: null,
    importingQoderModels: false,
  });
  const {
    connections, loading, providerNode, proxyPools, selectedConnection,
    modelAliases, customModels, modelTestResults, modelsTestError,
    testingModelIds, selectedConnectionIds, bulkUpdatingProxy,
    providerStrategy, providerStickyLimit, autoPing, suggestedModels,
    kiloFreeModels, disabledModelIds, confirmState, importingQoderModels,
  } = state;
  const bulkProxyPoolIdRef = useRef("__none__");
  const thinkingModeRef = useRef(
    (initialSettings?.providerThinking || {})[providerId]?.mode || "auto"
  );
  const stopOneByOneRef = useRef(false);
  const { copied, copy } = useCopyToClipboard();

  const AG_RISK_STORAGE_KEY = "ag_risk_confirmed";

  // --- All handlers and derived values (extracted from main component) ---



  const openOAuthConnection = () => {
    modalDispatch({ type: "OPEN", modal: "showOAuthModal" });
  };

  const triggerOAuthConnection = () => {
    if (providerId === "antigravity" && typeof window !== "undefined") {
      const confirmed = window.localStorage.getItem(AG_RISK_STORAGE_KEY) === "true";
      if (!confirmed) {
        modalDispatch({ type: "OPEN", modal: "showAgRiskModal" });
        return;
      }
    }
    if (isOAuth) {
      openOAuthConnection();
      return;
    }
    modalDispatch({ type: "OPEN", modal: "showAddApiKeyModal" });
  };

  const triggerApiKeyConnection = () => {
    modalDispatch({ type: "OPEN", modal: "showAddApiKeyModal" });
  };

  const triggerAddConnection = () => {
    if (isOAuth) {
      triggerOAuthConnection();
      return;
    }
    triggerApiKeyConnection();
  };

  const handleAgRiskConfirm = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AG_RISK_STORAGE_KEY, "true");
    }
    modalDispatch({ type: "CLOSE", modal: "showAgRiskModal" });
    if (isOAuth) {
      openOAuthConnection();
      return;
    }
    triggerApiKeyConnection();
  };

  const providerInfo = providerNode
    ? {
        id: providerNode.id,
        name: providerNode.name || (providerNode.type === "anthropic-compatible" ? "Anthropic Compatible" : "OpenAI Compatible"),
        color: providerNode.type === "anthropic-compatible" ? "#D97757" : "#10A37F",
        textIcon: providerNode.type === "anthropic-compatible" ? "AC" : "OC",
        apiType: providerNode.apiType,
        baseUrl: providerNode.baseUrl,
        type: providerNode.type,
      }
    : (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId] || WEB_COOKIE_PROVIDERS[providerId]);
  const authModes = providerInfo?.authModes || [];
  const isOAuth = !!OAUTH_PROVIDERS[providerId] || !!FREE_PROVIDERS[providerId] || authModes.includes("oauth");
  const supportsApiKeyAuth = !!APIKEY_PROVIDERS[providerId] || authModes.includes("apikey");
  const isFreeNoAuth = !!FREE_PROVIDERS[providerId]?.noAuth;
  const models = getModelsByProviderId(providerId);
  const providerAlias = getProviderAlias(providerId);

  const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
  const isAnthropicCompatible = isAnthropicCompatibleProvider(providerId);
  const isCompatible = isOpenAICompatible || isAnthropicCompatible;
  const hasDualAuthModes = !isCompatible && isOAuth && supportsApiKeyAuth;
  const oauthConnectionLabel = providerId === "xai" ? "Grok Build OAuth" : "OAuth";
  const apiKeyConnectionLabel = providerId === "xai" ? "xAI API Key" : "API Key";
  const thinkingConfig = AI_PROVIDERS[providerId]?.thinkingConfig || THINKING_CONFIG.extended;

  const providerStorageAlias = isCompatible ? providerId : providerAlias;
  const providerDisplayAlias = isCompatible
    ? (providerNode?.prefix || providerId)
    : providerAlias;

  const fetchDisabledModels = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) dispatch({ type: 'setDisabledModelIds', value: data.ids || [] });
    } catch (error) {
      console.log("Error fetching disabled models:", error);
    }
  }, [providerStorageAlias]);

  const handleDisableModel = async (modelId) => {
    try {
      const res = await fetch("/api/models/disabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAlias: providerStorageAlias, ids: [modelId] }),
      });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error disabling model:", error);
    }
  };

  const handleEnableModel = async (modelId) => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}&id=${encodeURIComponent(modelId)}`, { method: "DELETE" });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error enabling model:", error);
    }
  };

  const handleDisableAll = async (ids) => {
    if (!ids.length) return;
    dispatch({ type: 'setConfirmState', value: {
      title: "Disable All Models",
      message: `Disable all ${ids.length} model(s)?`,
      onConfirm: async () => {
        dispatch({ type: 'setConfirmState', value: null });
        try {
          const res = await fetch("/api/models/disabled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerAlias: providerStorageAlias, ids }),
          });
          if (res.ok) await fetchDisabledModels();
        } catch (error) {
          console.log("Error disabling all models:", error);
        }
      }
    } });
  };

  const handleEnableAll = async () => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}`, { method: "DELETE" });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error enabling all models:", error);
    }
  };

  // Define callbacks BEFORE the useEffect that uses them
  const fetchAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setModelAliases', value: data.aliases || {} });
      }
    } catch (error) {
      console.log("Error fetching aliases:", error);
    }
  }, []);

  const fetchCustomModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models/custom", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setCustomModels', value: data.models || [] });
      }
    } catch (error) {
      console.log("Error fetching custom models:", error);
    }
  }, []);

  // Fetch free models from Kilo API for kilocode provider
  useEffect(() => {
    if (providerId !== "kilocode") return;
    const controller = new AbortController();
    fetch("/api/providers/kilo/free-models", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => { if (data.models?.length) dispatch({ type: 'setKiloFreeModels', value: data.models }); })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, [providerId]);

  const fetchConnections = useCallback(async () => {
    try {
      const [connectionsRes, nodesRes, proxyPoolsRes, settingsRes] = await Promise.all([
        fetch("/api/providers", { cache: "no-store" }),
        fetch("/api/provider-nodes", { cache: "no-store" }),
        fetch("/api/proxy-pools?isActive=true", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const [connectionsData, nodesData, proxyPoolsData, settingsData] = await Promise.all([
        connectionsRes.json(),
        nodesRes.json(),
        proxyPoolsRes.json(),
        settingsRes.ok ? settingsRes.json() : Promise.resolve({}),
      ]);
      if (connectionsRes.ok) {
        const filtered = (connectionsData.connections || []).filter(c => c.provider === providerId);
        dispatch({ type: 'setConnections', value: filtered });
        dispatch({ type: 'setSelectedConnectionIds', value: (prev) => prev.filter((id) => filtered.some((conn) => conn.id === id)) });
      }
      if (proxyPoolsRes.ok) {
        dispatch({ type: 'setProxyPools', value: proxyPoolsData.proxyPools || [] });
      }
      // Load per-provider strategy override
      const override = (settingsData.providerStrategies || {})[providerId] || {};
      dispatch({ type: 'setProviderStrategy', value: override.fallbackStrategy || null });
      dispatch({ type: 'setProviderStickyLimit', value: override.stickyRoundRobinLimit != null ? String(override.stickyRoundRobinLimit) : "1" });
      // Load per-provider thinking config
      const thinkingCfg = (settingsData.providerThinking || {})[providerId] || {};
      thinkingModeRef.current = (thinkingCfg.mode || "auto");
      const autoPingSettingsKey = AUTO_PING_SETTINGS_KEYS[providerId];
      const apCfg = autoPingSettingsKey ? settingsData[autoPingSettingsKey] || {} : {};
      dispatch({ type: 'setAutoPing', value: { enabled: apCfg.enabled === true, connections: apCfg.connections || {} } });
      if (nodesRes.ok) {
        let node = (nodesData.nodes || []).find((entry) => entry.id === providerId) || null;

        // Newly created compatible nodes can be briefly unavailable on one worker.
        // Retry a few times before showing "Provider not found".
        if (!node && isCompatible) {
          for (let attempt = 0; attempt < 3; attempt += 1) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: retry with delay
            await new Promise((resolve) => setTimeout(resolve, 150));
            const retryRes = await fetch("/api/provider-nodes", { cache: "no-store" });
            if (!retryRes.ok) continue;
            const retryData = await retryRes.json();
            const retryNodeMap = new Map((retryData.nodes || []).map((e) => [e.id, e]));
            node = retryNodeMap.get(providerId) || null;
            if (node) break;
          }
        }

        dispatch({ type: 'setProviderNode', value: node });
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    } finally {
      dispatch({ type: 'setLoading', value: false });
    }
  }, [providerId, isCompatible]);

  const handleUpdateNode = async (formData) => {
    try {
      const res = await fetch(`/api/provider-nodes/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch({ type: 'setProviderNode', value: data.node });
        await fetchConnections();
        modalDispatch({ type: "CLOSE", modal: "showEditNodeModal" });
      }
    } catch (error) {
      console.log("Error updating provider node:", error);
    }
  };

  const saveProviderStrategy = async (strategy, stickyLimit) => {
    try {
      const settingsRes = await fetch("/api/settings", { cache: "no-store" });
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const current = settingsData.providerStrategies || {};

      // Build override: null strategy means remove override, use global
      const override = {};
      if (strategy) override.fallbackStrategy = strategy;
      if (strategy === "round-robin" && stickyLimit !== "") {
        override.stickyRoundRobinLimit = Number(stickyLimit) || 3;
      }

      const updated = { ...current };
      if (Object.keys(override).length === 0) {
        delete updated[providerId];
      } else {
        updated[providerId] = override;
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerStrategies: updated }),
      });
    } catch (error) {
      console.log("Error saving provider strategy:", error);
    }
  };

  const handleRoundRobinToggle = (enabled) => {
    const strategy = enabled ? "round-robin" : null;
    const sticky = enabled ? (providerStickyLimit || "1") : providerStickyLimit;
    if (enabled && !providerStickyLimit) dispatch({ type: 'setProviderStickyLimit', value: "1" });
    dispatch({ type: 'setProviderStrategy', value: strategy });
    saveProviderStrategy(strategy, sticky);
  };

  const handleStickyLimitChange = (value) => {
    dispatch({ type: 'setProviderStickyLimit', value });
    saveProviderStrategy("round-robin", value);
  };

  const saveThinkingConfig = async (mode) => {
    try {
      const settingsRes = await fetch("/api/settings", { cache: "no-store" });
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const current = settingsData.providerThinking || {};
      const updated = { ...current };
      if (!mode || mode === "auto") {
        delete updated[providerId];
      } else {
        updated[providerId] = { mode };
      }
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerThinking: updated }),
      });
    } catch (error) {
      console.log("Error saving thinking config:", error);
    }
  };

  const handleThinkingModeChange = (mode) => {
    thinkingModeRef.current = (mode);
    saveThinkingConfig(mode);
  };

  const saveAutoPing = async (next) => {
    const autoPingSettingsKey = AUTO_PING_SETTINGS_KEYS[providerId];
    if (!autoPingSettingsKey) return;

    dispatch({ type: 'setAutoPing', value: next });
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [autoPingSettingsKey]: next }),
      });
    } catch (error) {
      console.log("Error saving auto-ping config:", error);
    }
  };

  const handleAutoPingConnection = (connectionId, on) => {
    saveAutoPing({ ...autoPing, connections: { ...autoPing.connections, [connectionId]: on } });
  };

  useEffect(() => {
    fetchAliases();
    fetchCustomModels();
    fetchDisabledModels();
  }, [fetchAliases, fetchCustomModels, fetchDisabledModels]);

  // Fetch suggested models from provider's public API (if configured)
  useEffect(() => {
    const fetcher = (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId])?.modelsFetcher;
    if (!fetcher) return;
    fetchSuggestedModels(fetcher).then((data) => dispatch({ type: 'setSuggestedModels', value: data }));
  }, [providerId]);

  const handleSetAlias = async (modelId, alias, providerAliasOverride = providerAlias) => {
    const fullModel = `${providerAliasOverride}/${modelId}`;
    try {
      const res = await fetch("/api/models/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: fullModel, alias }),
      });
      if (res.ok) {
        await fetchAliases();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to set alias");
      }
    } catch (error) {
      console.log("Error setting alias:", error);
    }
  };

  const handleDeleteAlias = async (alias) => {
    try {
      const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAliases();
      }
    } catch (error) {
      console.log("Error deleting alias:", error);
    }
  };

  const handleAddCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias) => {
    try {
      const res = await fetch("/api/models/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAlias: providerAliasOverride, id: modelId, type }),
      });
      if (res.ok) {
        await fetchCustomModels();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("customModelChanged"));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add custom model");
      }
    } catch (error) {
      console.log("Error adding custom model:", error);
    }
  };

  const handleDeleteCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias) => {
    try {
      const params = new URLSearchParams({ providerAlias: providerAliasOverride, id: modelId, type });
      const res = await fetch(`/api/models/custom?${params}`, { method: "DELETE" });
      if (res.ok) {
        await fetchCustomModels();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("customModelChanged"));
      }
    } catch (error) {
      console.log("Error deleting custom model:", error);
    }
  };

  // Fetch Qoder model list and automatically add to available models
  const handleImportQoderModels = async () => {
    if (importingQoderModels) return;
    const activeConnection = connections.find((conn) => conn.isActive !== false);
    if (!activeConnection) {
      alert(translate("Please add an active Qoder connection first"));
      return;
    }

    dispatch({ type: 'setImportingQoderModels', value: true });
    try {
      const res = await fetch(`/api/providers/${activeConnection.id}/models`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || translate("Failed to fetch models"));
        return;
      }
      const models = data.models || [];
      if (models.length === 0) {
        alert(translate("No models returned"));
        return;
      }

      const modelAliasValues = new Set(Object.values(modelAliases));
      let importedCount = 0;
      for (const model of models) {
        const modelId = model.id || model.name;
        if (!modelId) continue;

        // Qoder model ID format may be "qoder/auto" or "auto", need to remove prefix
        const cleanModelId = modelId.replace(/^qoder\//, "");
        const alreadyExists = customModels.some(
          (entry) => entry.providerAlias === providerStorageAlias && entry.id === cleanModelId && (entry.kind || entry.type || "llm") === "llm"
        ) || modelAliasValues.has(`${providerStorageAlias}/${cleanModelId}`);
        if (alreadyExists) {
          continue;
        }

        await handleAddCustomModel(cleanModelId, "llm", providerStorageAlias); // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: state-mutating callback per model
        importedCount += 1;
      }

      if (importedCount === 0) {
        alert(translate("All models already exist, no new models added"));
      } else {
        alert(translate("Successfully added") + ` ${importedCount} ` + translate("models"));
      }
    } catch (error) {
      console.log("Error importing Qoder models:", error);
      alert(translate("Error fetching models") + ": " + error.message);
    } finally {
      dispatch({ type: 'setImportingQoderModels', value: false });
    }
  };

  const handleRunOneByOneTest = async () => {
    if (oneByOne.running || connections.length === 0) return;

    const queuedState = Object.fromEntries(
      connections.map((connection) => [connection.id, { state: "queued", error: null }]),
    );

    stopOneByOneRef.current = false;
    oneByOneDispatch({
      type: "START",
      results: queuedState,
      summary: { total: connections.length, completed: 0, passed: 0, failed: 0, stopped: false },
    });

    let passed = 0;
    let failed = 0;

    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- sequential: one-by-one connection testing, each depends on prior result
      for (let index = 0; index < connections.length; index += 1) {
        if (stopOneByOneRef.current) {
          oneByOneDispatch({
            type: "SET_SUMMARY",
            summary: { total: connections.length, completed: index, passed, failed, stopped: true },
          });
          break;
        }

        const connection = connections[index];
        oneByOneDispatch({ type: "SET_CURRENT", id: connection.id });
        oneByOneDispatch({ type: "SET_RESULT", id: connection.id, result: { state: "testing", error: null } });

        try {
          const res = await fetch(`/api/providers/${connection.id}/test`, { method: "POST" });
          const data = await res.json();
          const valid = !!data.valid;

          if (valid) passed += 1;
          else failed += 1;

          oneByOneDispatch({
            type: "SET_RESULT",
            id: connection.id,
            result: { state: valid ? "success" : "failed", error: valid ? null : (data.error || null) },
          });
        } catch (error) {
          failed += 1;
          oneByOneDispatch({
            type: "SET_RESULT",
            id: connection.id,
            result: { state: "failed", error: error.message || "Test failed" },
          });
        }

        oneByOneDispatch({
          type: "SET_SUMMARY",
          summary: { total: connections.length, completed: index + 1, passed, failed, stopped: false },
        });

        if (index < connections.length - 1) {
          await sleep(ONE_BY_ONE_DELAY_MS);
        }
      }
    } finally {
      oneByOneDispatch({ type: "FINISH" });
      stopOneByOneRef.current = false;
    }
  };

  const handleStopOneByOneTest = () => {
    if (!oneByOne.running) return;
    stopOneByOneRef.current = true;
    oneByOneDispatch({ type: "STOPPING" });
  };

  const handleDelete = async (id) => {
    dispatch({ type: 'setConfirmState', value: {
      title: "Delete Connection",
      message: "Delete this connection?",
      onConfirm: async () => {
        dispatch({ type: 'setConfirmState', value: null });
        try {
          const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
          if (res.ok) {
            dispatch({ type: 'setConnections', value: (prev) => prev.filter(c => c.id !== id) });
            dispatch({ type: 'setSelectedConnectionIds', value: (prev) => prev.filter(sid => sid !== id) });
          }
        } catch (error) {
          console.log("Error deleting connection:", error);
        }
      }
    } });
  };

  const handleBulkDelete = () => {
    const count = selectedConnectionIds.length;
    if (count === 0) return;
    dispatch({ type: 'setConfirmState', value: {
      title: `Delete ${count} Connection${count > 1 ? "s" : ""}`,
      message: `Delete ${count} connection${count > 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        dispatch({ type: 'setConfirmState', value: null });
        const idsToDelete = [...selectedConnectionIds];
        const deleteResults = await Promise.all(idsToDelete.map(async (id) => {
          try {
            const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
            return res.ok;
          } catch (error) {
            console.log("Error deleting connection:", error);
            return false;
          }
        }));
        const failed = deleteResults.filter((r) => !r).length;
        dispatch({ type: 'setConnections', value: (prev) => prev.filter(c => !idsToDelete.includes(c.id)) });
        dispatch({ type: 'setSelectedConnectionIds', value: [] });
        if (failed > 0) alert(`Deleted ${idsToDelete.length - failed} connection(s), ${failed} failed.`);
      }
    } });
  };

  const handleOAuthSuccess = () => {
    fetchConnections();
    modalDispatch({ type: "CLOSE", modal: "showOAuthModal" });
  };

  const handleIFlowCookieSuccess = () => {
    fetchConnections();
    modalDispatch({ type: "CLOSE", modal: "showIFlowCookieModal" });
  };

  const handleSaveApiKey = async (formData) => {
    modalDispatch({ type: "SET_ERROR", value: "" });
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, ...formData }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        await fetchConnections();
        modalDispatch({ type: "CLOSE", modal: "showAddApiKeyModal" });
        return;
      }

      modalDispatch({ type: "SET_ERROR", value: data?.error || "Failed to save connection" });
    } catch (error) {
      console.log("Error saving connection:", error);
      modalDispatch({ type: "SET_ERROR", value: "Failed to save connection" });
    }
  };

  const handleUpdateConnection = async (formData) => {
    try {
      const res = await fetch(`/api/providers/${selectedConnection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchConnections();
        modalDispatch({ type: "CLOSE", modal: "showEditModal" });
      }
    } catch (error) {
      console.log("Error updating connection:", error);
    }
  };

  const handleUpdateConnectionStatus = async (id, isActive) => {
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        dispatch({ type: 'setConnections', value: (prev) => prev.map(c => c.id === id ? { ...c, isActive } : c) });
      }
    } catch (error) {
      console.log("Error updating connection status:", error);
    }
  };

  const handleSwapPriority = async (index1, index2) => {
    // Optimistic update state
    const newConnections = [...connections];
    [newConnections[index1], newConnections[index2]] = [newConnections[index2], newConnections[index1]];
    dispatch({ type: 'setConnections', value: newConnections });

    try {
      await Promise.all([
        fetch(`/api/providers/${newConnections[index1].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: index1 }),
        }),
        fetch(`/api/providers/${newConnections[index2].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: index2 }),
        }),
      ]);
    } catch (error) {
      console.log("Error swapping priority:", error);
      await fetchConnections();
    }
  };

  const selectedConnections = connections.filter((conn) => selectedConnectionIds.includes(conn.id));
  const allSelected = connections.length > 0 && selectedConnectionIds.length === connections.length;

  const toggleSelectConnection = (connectionId) => {
    dispatch({ type: 'setSelectedConnectionIds', value: (prev) => (
      prev.includes(connectionId)
        ? prev.filter((id) => id !== connectionId)
        : [...prev, connectionId]
    ) });
  };

  const toggleSelectAllConnections = () => {
    if (allSelected) {
      dispatch({ type: 'setSelectedConnectionIds', value: [] });
      return;
    }
    dispatch({ type: 'setSelectedConnectionIds', value: connections.map((conn) => conn.id) });
  };

  const clearSelection = () => {
    dispatch({ type: 'setSelectedConnectionIds', value: [] });
    bulkProxyPoolIdRef.current = "__none__";
  };

  const selectedProxySummary = (() => {
    if (selectedConnections.length === 0) return "";
    const poolIds = new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId || "__none__"));
    if (poolIds.size === 1) {
      const onlyId = [...poolIds][0];
      if (onlyId === "__none__") return "All selected currently unbound";
      const pool = proxyPools.find((p) => p.id === onlyId);
      return `All selected currently bound to ${pool?.name || onlyId}`;
    }
    return "Selected connections have mixed proxy bindings";
  })();

  const openBulkProxyModal = () => {
    if (selectedConnections.length === 0) return;
    const uniquePoolIds = [...new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId || "__none__"))];
    bulkProxyPoolIdRef.current = uniquePoolIds.length === 1 ? uniquePoolIds[0] : "__none__";
    modalDispatch({ type: "OPEN", modal: "showBulkProxyModal" });
  };

  const closeBulkProxyModal = () => {
    if (bulkUpdatingProxy) return;
    modalDispatch({ type: "CLOSE", modal: "showBulkProxyModal" });
  };

  const applyProxyAssignments = async (assignments) => {
    dispatch({ type: 'setBulkUpdatingProxy', value: true });
    try {
      const proxyResults = await Promise.all(assignments.map(async ({ connectionId, proxyPoolId }) => {
        try {
          const res = await fetch(`/api/providers/${connectionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proxyPoolId }),
          });
          return res.ok;
        } catch (e) {
          console.log("Error applying proxy for", connectionId, e);
          return false;
        }
      }));
      const failed = proxyResults.filter((r) => !r).length;
      if (failed > 0) alert(`Updated with ${failed} failed request(s).`);
      await fetchConnections();
      modalDispatch({ type: "CLOSE", modal: "showBulkProxyModal" });
    } finally {
      dispatch({ type: 'setBulkUpdatingProxy', value: false });
    }
  };

  const handleApplySinglePool = (proxyPoolId) => {
    const targets = connections.map((c) => ({ connectionId: c.id, proxyPoolId }));
    return applyProxyAssignments(targets);
  };

  const handleApplyOneToOne = () => {
    const activePools = proxyPools.filter((p) => p.isActive === true);
    if (activePools.length === 0) {
      alert("No active proxy pools available.");
      return;
    }
    const targets = connections.map((c, i) => ({
      connectionId: c.id,
      proxyPoolId: activePools[i % activePools.length].id,
    }));
    return applyProxyAssignments(targets);
  };


  const isSelected = (connectionId) => selectedConnectionIds.includes(connectionId);

  const activePools = proxyPools.filter((p) => p.isActive === true);

  const handleTestModel = async (modelId) => {
    if (testingModelIds.has(modelId)) return;
    dispatch({ type: 'setTestingModelIds', value: (prev) => new Set(prev).add(modelId) });
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}` }),
      });
      const data = await res.json();
      dispatch({ type: 'setModelTestResults', value: (prev) => ({ ...prev, [modelId]: data.ok ? "ok" : "error" }) });
      dispatch({ type: 'setModelsTestError', value: data.ok ? "" : (data.error || "Model not reachable") });
    } catch {
      dispatch({ type: 'setModelTestResults', value: (prev) => ({ ...prev, [modelId]: "error" }) });
      dispatch({ type: 'setModelsTestError', value: "Network error" });
    } finally {
      dispatch({ type: 'setTestingModelIds', value: (prev) => { const n = new Set(prev); n.delete(modelId); return n; } });
    }
  };

  const handleDeleteCompatibleNode = () => {
    dispatch({ type: 'setConfirmState', value: {
      title: "Delete Compatible Node",
      message: `Delete this ${isAnthropicCompatible ? "Anthropic" : "OpenAI"} Compatible node?`,
      onConfirm: async () => {
        dispatch({ type: 'setConfirmState', value: null });
        try {
          const res = await fetch(`/api/provider-nodes/${providerId}`, { method: "DELETE" });
          if (res.ok) router.push("/dashboard/providers");
        } catch (error) {
          console.log("Error deleting provider node:", error);
        }
      }
    } });
  };

  return {
    connections, loading, providerNode, proxyPools, selectedConnection,
    modelAliases, customModels, modelTestResults, modelsTestError,
    testingModelIds, selectedConnectionIds, bulkUpdatingProxy,
    providerStrategy, providerStickyLimit, autoPing, suggestedModels,
    kiloFreeModels, disabledModelIds, confirmState, importingQoderModels,
    modals, modalDispatch, oneByOne,
    providerId, providerInfo, isOAuth, isFreeNoAuth,
    models, providerAlias, isOpenAICompatible, isAnthropicCompatible, isCompatible,
    hasDualAuthModes, oauthConnectionLabel, apiKeyConnectionLabel,
    providerStorageAlias, providerDisplayAlias,
    selectedConnections, allSelected, toggleSelectConnection, toggleSelectAllConnections,
    isSelected, activePools,
    getCaps, copied, copy, dispatch, router,
    handleAgRiskConfirm, handleOAuthSuccess, handleIFlowCookieSuccess,
    handleSaveApiKey, handleUpdateConnection, handleUpdateNode,
    handleUpdateConnectionStatus, handleSwapPriority,
    handleDelete, handleBulkDelete,
    handleRoundRobinToggle, handleStickyLimitChange,
    handleAutoPingConnection,
    handleSetAlias, handleDeleteAlias,
    handleAddCustomModel, handleDeleteCustomModel,
    handleDisableModel, handleEnableModel, handleDisableAll, handleEnableAll,
    handleTestModel, handleImportQoderModels,
    handleRunOneByOneTest, handleStopOneByOneTest,
    triggerOAuthConnection, triggerApiKeyConnection, triggerAddConnection,
    closeBulkProxyModal, handleApplySinglePool, handleApplyOneToOne,
    fetchConnections, handleDeleteCompatibleNode,
  };
}

function AvailableModelsCard({
  isCompatible, models, kiloFreeModels, disabledModelIds, modelsTestError,
  handleEnableAll, handleDisableAll,
  providerStorageAlias, providerDisplayAlias, modelAliases, customModels,
  copied, copy, connections, isAnthropicCompatible, modelTestResults,
  testingModelIds, isFreeNoAuth, providerId, importingQoderModels,
  suggestedModels, getCaps, modalDispatch,
  handleSetAlias, handleDeleteAlias, handleAddCustomModel,
  handleDeleteCustomModel, handleTestModel, handleImportQoderModels,
  handleDisableModel, handleEnableModel,
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          {"Available Models"}
        </h2>
        {!isCompatible && (() => {
          const merged = [...models, ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id))];
          const allIds = [];
          for (const m of merged) { const k = getModelKind(m); if (!k || k === "llm") allIds.push(m.id); }
          const activeIds = allIds.filter((id) => !disabledModelIds.includes(id));
          return (
            <div className="flex gap-2">
              {disabledModelIds.length > 0 && (
                <Button size="sm" variant="secondary" icon="restart_alt" onClick={handleEnableAll}>
                  Active All
                </Button>
              )}
              {activeIds.length > 0 && (
                <Button size="sm" variant="secondary" icon="block" onClick={() => handleDisableAll(activeIds)}>
                  Disable All
                </Button>
              )}
            </div>
          );
        })()}
      </div>
      {!!modelsTestError && (
        <p className="text-xs text-red-500 mb-3 break-words">{modelsTestError}</p>
      )}
      <ModelsSection
        isCompatible={isCompatible}
        providerStorageAlias={providerStorageAlias}
        providerDisplayAlias={providerDisplayAlias}
        modelAliases={modelAliases}
        customModels={customModels}
        copied={copied}
        onCopy={copy}
        connections={connections}
        isAnthropicCompatible={isAnthropicCompatible}
        models={models}
        kiloFreeModels={kiloFreeModels}
        disabledModelIds={disabledModelIds}
        modelTestResults={modelTestResults}
        testingModelIds={testingModelIds}
        isFreeNoAuth={isFreeNoAuth}
        providerId={providerId}
        importingQoderModels={importingQoderModels}
        suggestedModels={suggestedModels}
        getCaps={getCaps}
        modalDispatch={modalDispatch}
        onSetAlias={handleSetAlias}
        onDeleteAlias={handleDeleteAlias}
        onAddCustomModel={handleAddCustomModel}
        onDeleteCustomModel={handleDeleteCustomModel}
        onTestModel={handleTestModel}
        onImportQoderModels={handleImportQoderModels}
        onDisableModel={handleDisableModel}
        onEnableModel={handleEnableModel}
      />
    </Card>
  );
}

export default function ProviderDetailClient({ initialConnections, initialProviderNode, initialProxyPools, initialSettings }) {
  const {
    connections, loading, providerNode, proxyPools, selectedConnection,
    modelAliases, customModels, modelTestResults, modelsTestError,
    testingModelIds, selectedConnectionIds, bulkUpdatingProxy,
    providerStrategy, providerStickyLimit, autoPing, suggestedModels,
    kiloFreeModels, disabledModelIds, confirmState, importingQoderModels,
    modals, modalDispatch, oneByOne,
    providerId, providerInfo, isOAuth, isFreeNoAuth,
    models, providerAlias, isOpenAICompatible, isAnthropicCompatible, isCompatible,
    hasDualAuthModes, oauthConnectionLabel, apiKeyConnectionLabel,
    providerStorageAlias, providerDisplayAlias,
    selectedConnections, allSelected, toggleSelectConnection, toggleSelectAllConnections,
    isSelected, activePools,
    getCaps, copied, copy, dispatch, router,
    handleAgRiskConfirm, handleOAuthSuccess, handleIFlowCookieSuccess,
    handleSaveApiKey, handleUpdateConnection, handleUpdateNode,
    handleUpdateConnectionStatus, handleSwapPriority,
    handleDelete, handleBulkDelete,
    handleRoundRobinToggle, handleStickyLimitChange,
    handleAutoPingConnection,
    handleSetAlias, handleDeleteAlias,
    handleAddCustomModel, handleDeleteCustomModel,
    handleDisableModel, handleEnableModel, handleDisableAll, handleEnableAll,
    handleTestModel, handleImportQoderModels,
    handleRunOneByOneTest, handleStopOneByOneTest,
    triggerOAuthConnection, triggerApiKeyConnection, triggerAddConnection,
    closeBulkProxyModal, handleApplySinglePool, handleApplyOneToOne,
    fetchConnections, handleDeleteCompatibleNode,
  } = useProviderActions({ initialSettings, initialConnections, initialProviderNode, initialProxyPools });

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!providerInfo) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Provider not found</p>
        <Link href="/dashboard/providers" className="text-primary mt-4 inline-block">
          Back to Providers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:gap-8 sm:px-0">
      <ProviderHeader
        providerInfo={providerInfo}
        isOpenAICompatible={isOpenAICompatible}
        isAnthropicCompatible={isAnthropicCompatible}
        connectionCount={connections.length}
      />

      <ProviderNotices providerInfo={providerInfo} />

      {isCompatible && providerNode && (
        <CompatibleNodeDetailsCard
          isAnthropicCompatible={isAnthropicCompatible}
          providerNode={providerNode}
          providerId={providerId}
          onAddKey={() => modalDispatch({ type: "OPEN", modal: "showAddApiKeyModal" })}
          onEdit={() => modalDispatch({ type: "OPEN", modal: "showEditNodeModal" })}
          onDelete={handleDeleteCompatibleNode}
        />
      )}

      <ConnectionsCard
        providerId={providerId}
        isCompatible={isCompatible}
        isOAuth={isOAuth}
        isFreeNoAuth={isFreeNoAuth}
        hasDualAuthModes={hasDualAuthModes}
        oauthConnectionLabel={oauthConnectionLabel}
        apiKeyConnectionLabel={apiKeyConnectionLabel}
        connections={connections}
        proxyPools={proxyPools}
        selectedConnectionIds={selectedConnectionIds}
        oneByOne={oneByOne}
        providerStrategy={providerStrategy}
        providerStickyLimit={providerStickyLimit}
        autoPing={autoPing}
        allSelected={allSelected}
        isSelected={isSelected}
        toggleSelectConnection={toggleSelectConnection}
        toggleSelectAllConnections={toggleSelectAllConnections}
        handleBulkDelete={handleBulkDelete}
        handleRunOneByOneTest={handleRunOneByOneTest}
        handleStopOneByOneTest={handleStopOneByOneTest}
        triggerOAuthConnection={triggerOAuthConnection}
        triggerApiKeyConnection={triggerApiKeyConnection}
        triggerAddConnection={triggerAddConnection}
        handleRoundRobinToggle={handleRoundRobinToggle}
        handleStickyLimitChange={handleStickyLimitChange}
        handleSwapPriority={handleSwapPriority}
        handleUpdateConnectionStatus={handleUpdateConnectionStatus}
        handleAutoPingConnection={handleAutoPingConnection}
        handleDelete={handleDelete}
        dispatch={dispatch}
        modalDispatch={modalDispatch}
      />

      <AvailableModelsCard
        isCompatible={isCompatible}
        models={models}
        kiloFreeModels={kiloFreeModels}
        disabledModelIds={disabledModelIds}
        modelsTestError={modelsTestError}
        handleEnableAll={handleEnableAll}
        handleDisableAll={handleDisableAll}
        providerStorageAlias={providerStorageAlias}
        providerDisplayAlias={providerDisplayAlias}
        modelAliases={modelAliases}
        customModels={customModels}
        copied={copied}
        copy={copy}
        connections={connections}
        isAnthropicCompatible={isAnthropicCompatible}
        modelTestResults={modelTestResults}
        testingModelIds={testingModelIds}
        isFreeNoAuth={isFreeNoAuth}
        providerId={providerId}
        importingQoderModels={importingQoderModels}
        suggestedModels={suggestedModels}
        getCaps={getCaps}
        modalDispatch={modalDispatch}
        handleSetAlias={handleSetAlias}
        handleDeleteAlias={handleDeleteAlias}
        handleAddCustomModel={handleAddCustomModel}
        handleDeleteCustomModel={handleDeleteCustomModel}
        handleTestModel={handleTestModel}
        handleImportQoderModels={handleImportQoderModels}
        handleDisableModel={handleDisableModel}
        handleEnableModel={handleEnableModel}
      />

      <BulkProxyModal
        isOpen={modals.showBulkProxyModal}
        onClose={closeBulkProxyModal}
        connections={connections}
        proxyPools={proxyPools}
        bulkUpdatingProxy={bulkUpdatingProxy}
        onApplySinglePool={handleApplySinglePool}
        onApplyOneToOne={handleApplyOneToOne}
      />

      <ProviderModals
        providerId={providerId}
        modals={modals}
        modalDispatch={modalDispatch}
        providerInfo={providerInfo}
        selectedConnection={selectedConnection}
        proxyPools={proxyPools}
        isCompatible={isCompatible}
        isAnthropicCompatible={isAnthropicCompatible}
        providerNode={providerNode}
        providerStorageAlias={providerStorageAlias}
        providerDisplayAlias={providerDisplayAlias}
        confirmState={confirmState}
        onOAuthSuccess={handleOAuthSuccess}
        onIFlowCookieSuccess={handleIFlowCookieSuccess}
        onSaveApiKey={handleSaveApiKey}
        onUpdateConnection={handleUpdateConnection}
        onUpdateNode={handleUpdateNode}
        onAgRiskConfirm={handleAgRiskConfirm}
        onFetchConnections={fetchConnections}
        onAddCustomModel={handleAddCustomModel}
        onCloseConfirm={() => dispatch({ type: 'setConfirmState', value: null })}
      />
    </div>
  );
}
