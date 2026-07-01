"use client";

import { useState, useEffect, useReducer, useCallback, useRef } from "react";
import { Card, Button, ManualConfigModal, ComboFormModal, McpMarketplaceModal, ModelSelectModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";

const ENDPOINT = "/api/cli-tools/cowork-settings";

const stripV1 = (url) => (url || "").replace(/\/v1\/?$/, "");
const ensureV1 = (url) => {
  const trimmed = (url || "").replace(/\/+$/, "");
  if (!trimmed) return "";
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
};

const formInitialState = {
  selectedApiKey: "",
  selectedModels: [],
  customBaseUrl: "",
  plugins: [],
  localPlugins: [],
  customPlugins: [],
  modelAliases: {},
};

function formReducer(state, action) {
  switch (action.type) {
    case "INIT_FROM_STATUS": {
      const s = action.status;
      return {
        ...state,
        selectedModels:
          s?.cowork?.models?.length ? s.cowork.models : state.selectedModels,
        customBaseUrl:
          s?.cowork?.baseUrl && !state.customBaseUrl
            ? stripV1(s.cowork.baseUrl)
            : state.customBaseUrl,
        plugins:
          Array.isArray(s?.cowork?.plugins) && s.cowork.plugins.length > 0
            ? s.cowork.plugins
            : state.plugins.length === 0 &&
                Array.isArray(s?.defaultPlugins)
              ? s.defaultPlugins
              : state.plugins,
        localPlugins: Array.isArray(s?.cowork?.localPlugins)
          ? s.cowork.localPlugins
          : state.localPlugins,
        customPlugins:
          Array.isArray(s?.cowork?.customPlugins) &&
          s.cowork.customPlugins.length > 0
            ? s.cowork.customPlugins
            : state.customPlugins,
      };
    }
    case "SET_SELECTED_API_KEY":
      return { ...state, selectedApiKey: action.payload };
    case "SET_SELECTED_MODELS":
      return { ...state, selectedModels: action.payload };
    case "ADD_MODEL":
      return state.selectedModels.includes(action.payload)
        ? state
        : { ...state, selectedModels: [...state.selectedModels, action.payload] };
    case "REMOVE_MODEL":
      return {
        ...state,
        selectedModels: state.selectedModels.filter(
          (m) => m !== action.payload,
        ),
      };
    case "SET_CUSTOM_BASE_URL":
      return { ...state, customBaseUrl: action.payload };
    case "SET_PLUGINS":
      return { ...state, plugins: action.payload };
    case "ADD_PLUGIN":
      return state.plugins.some((x) => x.name === action.payload.name)
        ? state
        : { ...state, plugins: [...state.plugins, action.payload] };
    case "REMOVE_PLUGIN":
      return {
        ...state,
        plugins: state.plugins.filter((p) => p.name !== action.payload),
      };
    case "SET_LOCAL_PLUGINS":
      return { ...state, localPlugins: action.payload };
    case "SET_CUSTOM_PLUGINS":
      return { ...state, customPlugins: action.payload };
    case "ADD_CUSTOM_PLUGIN":
      return {
        ...state,
        customPlugins: [
          ...state.customPlugins.filter(
            (x) => x.name !== action.payload.name,
          ),
          action.payload,
        ],
      };
    case "SET_MODEL_ALIASES":
      return { ...state, modelAliases: action.payload };
    case "RESET_FORM":
      return {
        ...state,
        selectedModels: [],
        localPlugins: [],
        customPlugins: [],
        plugins: action.defaultPlugins || [],
      };
    default:
      return state;
  }
}

const uiInitialState = {
  checking: false,
  applying: false,
  restoring: false,
  message: null,
  showManualConfigModal: false,
  comboModalOpen: false,
  modelSelectOpen: false,
  marketplaceOpen: false,
  addMcpOpen: false,
  addMcpForm: { name: "", url: "" },
};

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_CHECKING":
      return { ...state, checking: action.payload };
    case "SET_APPLYING":
      return { ...state, applying: action.payload };
    case "SET_RESTORING":
      return { ...state, restoring: action.payload };
    case "SET_MESSAGE":
      return { ...state, message: action.payload };
    case "SET_MANUAL_MODAL":
      return { ...state, showManualConfigModal: action.payload };
    case "SET_COMBO_MODAL":
      return { ...state, comboModalOpen: action.payload };
    case "SET_MODEL_SELECT":
      return { ...state, modelSelectOpen: action.payload };
    case "SET_MARKETPLACE":
      return { ...state, marketplaceOpen: action.payload };
    case "SET_ADD_MCP_OPEN":
      return { ...state, addMcpOpen: action.payload };
    case "UPDATE_ADD_MCP_FORM":
      return { ...state, addMcpForm: { ...state.addMcpForm, ...action.payload } };
    case "RESET_ADD_MCP_FORM":
      return { ...state, addMcpForm: { name: "", url: "" } };
    default:
      return state;
  }
}

// ---- CoworkConfigSection ----
function CoworkConfigSection({
  formState,
  formDispatch,
  uiState,
  uiDispatch,
  status,
  hasActiveProviders,
  getEffectiveBaseUrl,
  cloudEnabled,
  cloudUrl,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
  handleApply,
  handleReset,
  handleRemoveModel,
  removePlugin,
  apiKeys,
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
            Select Endpoint
          </span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
            arrow_forward
          </span>
          <BaseUrlSelect
            value={getEffectiveBaseUrl()}
            onChange={(url) =>
              formDispatch({
                type: "SET_CUSTOM_BASE_URL",
                payload: stripV1(url),
              })
            }
            tunnelEnabled={tunnelEnabled}
            tunnelPublicUrl={tunnelPublicUrl}
            tailscaleEnabled={tailscaleEnabled}
            tailscaleUrl={tailscaleUrl}
            cloudEnabled={cloudEnabled}
            cloudUrl={cloudUrl}
          />
        </div>

        {status?.cowork?.baseUrl && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
            <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
              Current
            </span>
            <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
              arrow_forward
            </span>
            <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
              {status.cowork.baseUrl}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
          <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">
            API Key
          </span>
          <span className="material-symbols-outlined hidden text-text-muted text-[14px] sm:inline">
            arrow_forward
          </span>
          <ApiKeySelect
            value={formState.selectedApiKey}
            onChange={(val) =>
              formDispatch({
                type: "SET_SELECTED_API_KEY",
                payload: val,
              })
            }
            apiKeys={apiKeys}
            cloudEnabled={cloudEnabled}
          />
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right">
            Models
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px]">
            arrow_forward
          </span>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 flex flex-wrap gap-1.5 min-h-[28px] px-2 py-1.5 bg-surface rounded border border-border">
              {formState.selectedModels.length === 0 ? (
                <span className="text-xs text-text-muted">
                  No models selected
                </span>
              ) : (
                formState.selectedModels.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-black/5 dark:bg-white/5 text-text-muted border border-transparent hover:border-border"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(m)}
                      className="ml-0.5 hover:text-red-500"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        close
                      </span>
                    </button>
                  </span>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                uiDispatch({
                  type: "SET_COMBO_MODAL",
                  payload: true,
                })
              }
              disabled={!hasActiveProviders}
              className={`shrink-0 px-2 py-1.5 rounded border text-xs whitespace-nowrap transition-colors ${hasActiveProviders ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}
            >
              + Combo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-start sm:gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right pt-2">
            MCP
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px] mt-2">
            arrow_forward
          </span>
          <div className="flex-1 flex flex-col gap-1">
            {/* Preset plugins */}
            {formState.plugins.flatMap((p) =>
              p.name !== "exa" ? [(
                <div
                  key={p.name}
                  className="flex items-center gap-2 px-2 py-1 bg-surface rounded border border-border"
                >
                  <span className="text-xs font-medium min-w-0 truncate flex-shrink-0">
                    {p.title || p.name}
                  </span>
                  {p.oauth && (
                    <span className="text-[8px] text-amber-600 shrink-0">
                      OAuth
                    </span>
                  )}
                  <div
                    className="flex-1 flex flex-wrap gap-1 overflow-hidden"
                    style={{ maxHeight: "1.5rem" }}
                  >
                    {Array.isArray(p.toolNames) &&
                      p.toolNames.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="text-[9px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/5 text-text-muted whitespace-nowrap"
                        >
                          {t}
                        </span>
                      ))}
                    {Array.isArray(p.toolNames) &&
                      p.toolNames.length > 6 && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-black/5 dark:bg-white/5 text-text-muted whitespace-nowrap">
                          +{p.toolNames.length - 6}
                        </span>
                      )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlugin(p.name)}
                    className="shrink-0 hover:text-red-500 ml-auto"
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      close
                    </span>
                  </button>
                </div>
              )] : []
            )}
            {/* Custom plugins */}
            {formState.customPlugins.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-2 py-1 bg-surface rounded border border-border"
              >
                <span className="text-xs font-medium min-w-0 truncate flex-shrink-0">
                  {p.name}
                </span>
                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 shrink-0">
                  custom
                </span>
                <span className="flex-1 text-[9px] text-text-muted truncate">
                  {p.url}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    formDispatch({
                      type: "SET_CUSTOM_PLUGINS",
                      payload: formState.customPlugins.filter(
                        (x) => x.name !== p.name,
                      ),
                    })
                  }
                  className="shrink-0 hover:text-red-500 ml-auto"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    close
                  </span>
                </button>
              </div>
            ))}
            {formState.plugins.filter((p) => p.name !== "exa")
              .length === 0 &&
              formState.customPlugins.length === 0 && (
                <div className="px-2 py-1.5 bg-surface rounded border border-border text-xs text-text-muted">
                  No MCPs added
                </div>
              )}
            {/* Actions row */}
            <div className="flex items-center gap-2 mt-0.5">
              <button
                type="button"
                onClick={() =>
                  uiDispatch({
                    type: "SET_MARKETPLACE",
                    payload: true,
                  })
                }
                className="px-2 py-1 rounded border text-xs bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 cursor-pointer whitespace-nowrap"
              >
                + Browse
              </button>
              <button
                type="button"
                onClick={() => {
                  uiDispatch({ type: "RESET_ADD_MCP_FORM" });
                  uiDispatch({
                    type: "SET_ADD_MCP_OPEN",
                    payload: true,
                  });
                }}
                className="px-2 py-1 rounded border text-xs bg-surface border-border text-text-muted hover:border-primary hover:text-primary cursor-pointer whitespace-nowrap"
              >
                + Custom
              </button>
              <a
                href="https://mcp.so"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-text-muted hover:text-primary underline ml-auto"
              >
                Find MCPs →
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-start sm:gap-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right pt-1">
            Tools
          </span>
          <span className="material-symbols-outlined text-text-muted text-[14px] mt-1.5">
            arrow_forward
          </span>
          <div className="flex-1 flex flex-col gap-1.5">
            {(() => {
              const exaEnabled = formState.plugins.some(
                (p) => p.name === "exa",
              );
              const exaDef = (status?.defaultPlugins || []).find(
                (d) => d.name === "exa",
              );
              return (
                <label className="flex items-start gap-2 cursor-pointer px-2 py-1.5 bg-surface rounded border border-border">
                  <input
                    type="checkbox"
                    checked={exaEnabled}
                    onChange={(e) => {
                      formDispatch({
                        type: "REMOVE_PLUGIN",
                        payload: "exa",
                      });
                      if (e.target.checked && exaDef)
                        formDispatch({
                          type: "ADD_PLUGIN",
                          payload: exaDef,
                        });
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">
                      Web Search & Fetch (Exa)
                    </div>
                    <p className="text-[10px] text-text-muted leading-snug">
                      Replaces built-in WebSearch/WebFetch. Auto-strips
                      duplicates from tool list.
                    </p>
                  </div>
                </label>
              );
            })()}
            {(() => {
              const browserDef = (
                status?.localStdioPlugins || []
              ).find((p) => p.name === "browsermcp");
              if (!browserDef) return null;
              const browserEnabled =
                formState.localPlugins.includes("browsermcp");
              return (
                <label className="flex items-start gap-2 cursor-pointer px-2 py-1.5 bg-surface rounded border border-border">
                  <input
                    type="checkbox"
                    checked={browserEnabled}
                    onChange={(e) =>
                      formDispatch({
                        type: "SET_LOCAL_PLUGINS",
                        payload: e.target.checked
                          ? [
                              ...formState.localPlugins,
                              "browsermcp",
                            ]
                          : formState.localPlugins.filter(
                              (n) => n !== "browsermcp",
                            ),
                      })
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">
                      Browser Control (Browser MCP)
                    </div>
                    <p className="text-[10px] text-text-muted leading-snug">
                      Controls your running Chrome. Auto-strips
                      Cowork&apos;s built-in browser tools.{" "}
                      <a
                        href={browserDef.extensionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Install Chrome extension
                      </a>
                    </p>
                  </div>
                </label>
              );
            })()}
          </div>
        </div>

        {Array.isArray(status?.localStdioPlugins) &&
          status.localStdioPlugins.filter(
            (p) => p.name !== "browsermcp",
          ).length > 0 && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-start sm:gap-2">
              <span className="w-32 shrink-0 text-sm font-semibold text-text-main text-right pt-1">
                Local Plugins
              </span>
              <span className="material-symbols-outlined text-text-muted text-[14px] mt-1.5">
                arrow_forward
              </span>
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col gap-1.5 px-2 py-1.5 bg-surface rounded border border-border">
                  {status.localStdioPlugins.flatMap((p) => {
                    if (p.name !== "browsermcp") {
                      const enabled = formState.localPlugins.includes(p.name);
                      return [(
                        <label
                          key={p.name}
                          className="flex items-start gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              formDispatch({
                                type: "SET_LOCAL_PLUGINS",
                                payload: e.target.checked
                                  ? [
                                      ...formState.localPlugins,
                                      p.name,
                                    ]
                                  : formState.localPlugins.filter(
                                      (n) => n !== p.name,
                                    ),
                              })
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium">
                                {p.title}
                              </span>
                              <span className="text-[8px] text-amber-600">
                                stdio
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted leading-snug">
                              {p.description}
                            </p>
                            {p.extensionUrl && (
                              <a
                                href={p.extensionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary underline"
                              >
                                Install Chrome extension
                              </a>
                            )}
                          </div>
                        </label>
                      )];
                    }
                    return [];
                  })}
                </div>
                <p className="text-[10px] text-text-muted leading-snug">
                  ⚠️ Local plugins run as subprocess via{" "}
                  <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/5">
                    npx
                  </code>
                  . Requires Node.js installed.
                </p>
              </div>
            </div>
          )}
      </div>

      {uiState.message && (
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${uiState.message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {uiState.message.type === "success"
              ? "check_circle"
              : "error"}
          </span>
          <span>{uiState.message.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={formState.selectedModels.length === 0}
          loading={uiState.applying}
          className="w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[14px] mr-1">
            save
          </span>
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!status.has9Router}
          loading={uiState.restoring}
          className="w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[14px] mr-1">
            restore
          </span>
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            uiDispatch({
              type: "SET_MANUAL_MODAL",
              payload: true,
            })
          }
          className="w-full sm:w-auto"
        >
          <span className="material-symbols-outlined text-[14px] mr-1">
            content_copy
          </span>
          Manual Config
        </Button>
      </div>
    </>
  );
}

// ---- AddCustomMcpModal ----
function AddCustomMcpModal({ addMcpForm, formDispatch, uiDispatch }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="button"
      tabIndex={0}
      onClick={() =>
        uiDispatch({ type: "SET_ADD_MCP_OPEN", payload: false })
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape")
          uiDispatch({ type: "SET_ADD_MCP_OPEN", payload: false });
      }}
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Add Custom MCP</h3>
          <button
            type="button"
            onClick={() =>
              uiDispatch({ type: "SET_ADD_MCP_OPEN", payload: false })
            }
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined text-[18px]">
              close
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="addMcpName" className="text-[11px] text-text-muted font-medium">
              Name
            </label>
            <input
              id="addMcpName"
              type="text"
              placeholder="my-mcp"
              value={addMcpForm.name}
              onChange={(e) =>
                uiDispatch({
                  type: "UPDATE_ADD_MCP_FORM",
                  payload: {
                    name: e.target.value
                      .replace(/\s+/g, "-")
                      .toLowerCase(),
                  },
                })
              }
              className="px-2 py-1.5 rounded border border-border bg-surface text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="addMcpUrl" className="text-[11px] text-text-muted font-medium">
              SSE URL
            </label>
            <input
              id="addMcpUrl"
              type="text"
              placeholder="https://your-mcp-server.com/sse"
              value={addMcpForm.url}
              onChange={(e) =>
                uiDispatch({
                  type: "UPDATE_ADD_MCP_FORM",
                  payload: { url: e.target.value },
                })
              }
              className="px-2 py-1.5 rounded border border-border bg-surface text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() =>
              uiDispatch({ type: "SET_ADD_MCP_OPEN", payload: false })
            }
            className="px-3 py-1.5 rounded border border-border text-xs text-text-muted hover:bg-surface cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const name = addMcpForm.name.trim();
              if (!name || !addMcpForm.url.trim()) return;
              formDispatch({
                type: "ADD_CUSTOM_PLUGIN",
                payload: {
                  name,
                  url: addMcpForm.url.trim(),
                  transport: "sse",
                  custom: true,
                },
              });
              uiDispatch({
                type: "SET_ADD_MCP_OPEN",
                payload: false,
              });
            }}
            className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:opacity-90 cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ----
export default function CoworkToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  activeProviders,
  hasActiveProviders,
  cloudEnabled,
  cloudUrl,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
  initialStatus,
}) {
  const [status, setStatus] = useState(initialStatus || null);
  const [formState, formDispatch] = useReducer(formReducer, formInitialState, (init) => ({
    ...init,
    selectedApiKey: apiKeys?.length > 0 ? apiKeys[0].key : "",
  }));
  const [uiState, uiDispatch] = useReducer(uiReducer, uiInitialState);

  const initialStatusRef = useRef(initialStatus);
  useEffect(() => {
    if (initialStatusRef.current !== initialStatus) {
      initialStatusRef.current = initialStatus;
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  useEffect(() => {
    formDispatch({ type: "INIT_FROM_STATUS", status });
  }, [status]);

  const checkStatus = useCallback(async () => {
    uiDispatch({ type: "SET_CHECKING", payload: true });
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus({ installed: false, error: error.message });
    } finally {
      uiDispatch({ type: "SET_CHECKING", payload: false });
    }
  }, []);

  const fetchModelAliases = useCallback(() => {
    fetch("/api/models/alias")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data)
          formDispatch({
            type: "SET_MODEL_ALIASES",
            payload: data.aliases || {},
          });
      })
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(() => {
    onToggle();
    if (!isExpanded) {
      checkStatus();
      fetchModelAliases();
    }
  }, [onToggle, isExpanded, checkStatus, fetchModelAliases]);

  const getEffectiveBaseUrl = () => ensureV1(formState.customBaseUrl);

  const getConfigStatus = () => {
    if (!status?.installed) return null;
    const url = status?.cowork?.baseUrl;
    if (!url) return "not_configured";
    return status.has9Router ? "configured" : "other";
  };

  const configStatus = getConfigStatus();

  const handleApply = async () => {
    uiDispatch({ type: "SET_MESSAGE", payload: null });
    const effectiveUrl = getEffectiveBaseUrl();

    if (formState.selectedModels.length === 0) {
      uiDispatch({
        type: "SET_MESSAGE",
        payload: { type: "error", text: "Please select at least one model" },
      });
      return;
    }

    uiDispatch({ type: "SET_APPLYING", payload: true });
    try {
      const keyToUse =
        formState.selectedApiKey?.trim() ||
        (apiKeys?.length > 0 ? apiKeys[0].key : null) ||
        (!cloudEnabled ? "sk_9router" : null);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: effectiveUrl,
          apiKey: keyToUse,
          models: formState.selectedModels,
          plugins: formState.plugins,
          localPlugins: formState.localPlugins,
          customPlugins: formState.customPlugins,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        uiDispatch({
          type: "SET_MESSAGE",
          payload: {
            type: "success",
            text: "Settings applied. Quit & reopen Claude Desktop to load.",
          },
        });
        checkStatus();
      } else {
        uiDispatch({
          type: "SET_MESSAGE",
          payload: {
            type: "error",
            text: data.error || "Failed to apply settings",
          },
        });
      }
    } catch (error) {
      uiDispatch({
        type: "SET_MESSAGE",
        payload: { type: "error", text: error.message },
      });
    } finally {
      uiDispatch({ type: "SET_APPLYING", payload: false });
    }
  };

  const handleCreateCombo = async ({ name, models }) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, models }),
      });
      if (!res.ok) {
        const err = await res.json();
        uiDispatch({
          type: "SET_MESSAGE",
          payload: {
            type: "error",
            text: err.error || "Failed to create combo",
          },
        });
        return;
      }
      formDispatch({ type: "ADD_MODEL", payload: name });
      uiDispatch({ type: "SET_COMBO_MODAL", payload: false });
      uiDispatch({
        type: "SET_MESSAGE",
        payload: {
          type: "success",
          text: `Combo "${name}" created and added.`,
        },
      });
    } catch (error) {
      uiDispatch({
        type: "SET_MESSAGE",
        payload: { type: "error", text: error.message },
      });
    }
  };

  const handleAddModel = (model) => {
    const value = model?.value || model?.name || model;
    if (!value || formState.selectedModels.includes(value)) return;
    formDispatch({ type: "ADD_MODEL", payload: value });
  };

  const handleRemoveModel = (model) => {
    const value = model?.value || model?.name || model;
    formDispatch({ type: "REMOVE_MODEL", payload: value });
  };

  const handleReset = async () => {
    uiDispatch({ type: "SET_RESTORING", payload: true });
    uiDispatch({ type: "SET_MESSAGE", payload: null });
    try {
      const res = await fetch(ENDPOINT, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        uiDispatch({
          type: "SET_MESSAGE",
          payload: {
            type: "success",
            text: "Settings reset successfully",
          },
        });
        formDispatch({ type: "SET_SELECTED_MODELS", payload: [] });
        formDispatch({
          type: "SET_PLUGINS",
          payload: status?.defaultPlugins || [],
        });
        formDispatch({ type: "SET_LOCAL_PLUGINS", payload: [] });
        formDispatch({ type: "SET_CUSTOM_PLUGINS", payload: [] });
        checkStatus();
      } else {
        uiDispatch({
          type: "SET_MESSAGE",
          payload: {
            type: "error",
            text: data.error || "Failed to reset",
          },
        });
      }
    } catch (error) {
      uiDispatch({
        type: "SET_MESSAGE",
        payload: { type: "error", text: error.message },
      });
    } finally {
      uiDispatch({ type: "SET_RESTORING", payload: false });
    }
  };

  const addPlugin = (p) => {
    formDispatch({ type: "ADD_PLUGIN", payload: p });
  };

  const removePlugin = (name) => {
    formDispatch({ type: "REMOVE_PLUGIN", payload: name });
  };

  const getManualConfigs = () => {
    const keyToUse =
      formState.selectedApiKey?.trim()
        ? formState.selectedApiKey
        : !cloudEnabled
          ? "sk_9router"
          : "<API_KEY_FROM_DASHBOARD>";

    const modelsToShow =
      formState.selectedModels.length > 0
        ? formState.selectedModels
        : ["provider/model-id"];
    const cfg = {
      inferenceProvider: "gateway",
      inferenceGatewayBaseUrl:
        getEffectiveBaseUrl() || "https://your-public-host/v1",
      inferenceGatewayApiKey: keyToUse,
      inferenceModels: modelsToShow.map((name) => ({ name })),
    };

    return [
      {
        filename:
          "~/Library/Application Support/Claude-3p/configLibrary/<appliedId>.json",
        content: JSON.stringify(cfg, null, 2),
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 sm:items-center"
        onClick={handleToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image
              src={tool.image}
              alt={tool.name}
              width={32}
              height={32}
              className="size-8 object-contain rounded-lg"
              sizes="32px"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              {configStatus === "configured" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                  Connected
                </span>
              )}
              {configStatus === "not_configured" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">
                  Not configured
                </span>
              )}
              {configStatus === "other" && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                  Other
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted truncate">
              {tool.description}
            </p>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {uiState.checking && (
            <div className="flex items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined animate-spin">
                progress_activity
              </span>
              <span>Checking Claude Cowork...</span>
            </div>
          )}

          {!uiState.checking && status && !status.installed && (
            <div className="flex flex-col gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-yellow-500">
                  warning
                </span>
                <div className="flex-1">
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">
                    Claude Desktop (Cowork mode) not detected
                  </p>
                  <p className="text-sm text-text-muted">
                    Open Claude Desktop → Help → Troubleshooting → Enable
                    Developer mode → Configure third-party inference, then
                    return here.
                  </p>
                </div>
              </div>
              <div className="pl-9">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    uiDispatch({
                      type: "SET_MANUAL_MODAL",
                      payload: true,
                    })
                  }
                  className="!bg-yellow-500/20 !border-yellow-500/40 !text-yellow-700 dark:!text-yellow-300 hover:!bg-yellow-500/30"
                >
                  <span className="material-symbols-outlined text-[18px] mr-1">
                    content_copy
                  </span>
                  Manual Config
                </Button>
              </div>
            </div>
          )}

          {!uiState.checking && status?.installed && (
            <CoworkConfigSection
              formState={formState}
              formDispatch={formDispatch}
              uiState={uiState}
              uiDispatch={uiDispatch}
              status={status}
              hasActiveProviders={hasActiveProviders}
              getEffectiveBaseUrl={getEffectiveBaseUrl}
              cloudEnabled={cloudEnabled}
              cloudUrl={cloudUrl}
              tunnelEnabled={tunnelEnabled}
              tunnelPublicUrl={tunnelPublicUrl}
              tailscaleEnabled={tailscaleEnabled}
              tailscaleUrl={tailscaleUrl}
              handleApply={handleApply}
              handleReset={handleReset}
              handleRemoveModel={handleRemoveModel}
              removePlugin={removePlugin}
              apiKeys={apiKeys}
            />
          )}
        </div>
      )}

      <ManualConfigModal
        isOpen={uiState.showManualConfigModal}
        onClose={() =>
          uiDispatch({ type: "SET_MANUAL_MODAL", payload: false })
        }
        title="Claude Cowork - Manual Configuration"
        configs={getManualConfigs()}
      />

      <ComboFormModal
        isOpen={uiState.comboModalOpen}
        combo={null}
        onClose={() => uiDispatch({ type: "SET_COMBO_MODAL", payload: false })}
        onSave={handleCreateCombo}
        activeProviders={activeProviders}
        forcePrefix="claude-"
        title="Create Cowork Combo"
      />

      <ModelSelectModal
        isOpen={uiState.modelSelectOpen}
        onClose={() =>
          uiDispatch({ type: "SET_MODEL_SELECT", payload: false })
        }
        onSelect={handleAddModel}
        onDeselect={handleRemoveModel}
        activeProviders={activeProviders}
        modelAliases={formState.modelAliases}
        title="Select Cowork Model"
        addedModelValues={formState.selectedModels}
        closeOnSelect={false}
      />

      <McpMarketplaceModal
        isOpen={uiState.marketplaceOpen}
        onClose={() =>
          uiDispatch({ type: "SET_MARKETPLACE", payload: false })
        }
        onAdd={addPlugin}
        addedNames={formState.plugins.map((p) => p.name)}
      />

      {uiState.addMcpOpen && (
        <AddCustomMcpModal
          addMcpForm={uiState.addMcpForm}
          formDispatch={formDispatch}
          uiDispatch={uiDispatch}
        />
      )}
    </Card>
  );
}
