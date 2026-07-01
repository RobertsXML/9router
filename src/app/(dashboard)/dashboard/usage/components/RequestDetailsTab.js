"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Drawer from "@/shared/components/Drawer";
import Pagination from "@/shared/components/Pagination";
import { cn } from "@/shared/utils/cn";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";

let providerNameCache = null;
let providerNodesCache = null;

async function fetchProviderNames() {
  if (providerNameCache && providerNodesCache) {
    return { providerNameCache, providerNodesCache };
  }

  const nodesRes = await fetch("/api/provider-nodes");
  const nodesData = await nodesRes.json();
  const nodes = nodesData.nodes || [];
  providerNodesCache = {};

  for (const node of nodes) {
    providerNodesCache[node.id] = node.name;
  }

  providerNameCache = {
    ...AI_PROVIDERS,
    ...providerNodesCache
  };

  return { providerNameCache, providerNodesCache };
}

function getProviderName(providerId, cache) {
  if (!providerId) return providerId;
  if (!cache) return providerId;

  const cached = cache[providerId];

  if (typeof cached === 'string') {
    return cached;
  }

  if (cached?.name) {
    return cached.name;
  }

  const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
  return providerConfig?.name || providerId;
}

function getInputTokens(tokens) {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cache = tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
  return prompt < cache ? cache : prompt;
}

// ── Reducer ─────────────────────────────────────────────────────

const initialState = {
  details: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
  loading: false,
  selectedDetail: null,
  isDrawerOpen: false,
  providers: [],
  providerNameCache: null,
  filters: { provider: "", startDate: "", endDate: "" },
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_DETAILS":
      return { ...state, details: action.details, pagination: { ...state.pagination, ...action.pagination }, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_FILTERS":
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case "SET_PAGINATION":
      return { ...state, pagination: { ...state.pagination, ...action.pagination } };
    case "SET_DRAWER":
      return { ...state, selectedDetail: action.detail, isDrawerOpen: action.open };
    case "SET_PROVIDERS":
      return { ...state, providers: action.providers, providerNameCache: action.cache ?? state.providerNameCache };
    default:
      return state;
  }
}

// ── Sub-components ──────────────────────────────────────────────

function CollapsibleSection({ title, children, defaultOpen = false, icon = null }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-black/5 dark:border-white/5 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="material-symbols-outlined text-[18px] text-text-muted">{icon}</span>}
          <span className="font-semibold text-sm text-text-main">{title}</span>
        </div>
        <span className={cn(
          "material-symbols-outlined text-[20px] text-text-muted transition-transform duration-200",
          isOpen ? "rotate-90" : ""
        )}>
          chevron_right
        </span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-black/5 dark:border-white/5">
          {children}
        </div>
      )}
    </div>
  );
}

function FilterBar({ filters, providers, onFilterChange, onClearFilters }) {
  return (
    <Card padding="md">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="provider-filter" className="text-sm font-medium text-text-main">Provider</label>
          <select
            id="provider-filter"
            value={filters.provider}
            onChange={(e) => onFilterChange({ provider: e.target.value })}
            className={cn(
              "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
              "text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20",
              "w-full min-w-0 cursor-pointer"
            )}
            style={{ colorScheme: 'auto' }}
          >
            <option value="">All Providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="start-date-filter" className="text-sm font-medium text-text-main">Start Date</label>
          <input
            id="start-date-filter"
            type="datetime-local"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ startDate: e.target.value })}
            className={cn(
              "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
              "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="end-date-filter" className="text-sm font-medium text-text-main">End Date</label>
          <input
            id="end-date-filter"
            type="datetime-local"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ endDate: e.target.value })}
            className={cn(
              "h-9 px-3 rounded-lg border border-black/10 dark:border-white/10 bg-surface",
              "w-full min-w-0 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
          <span className="hidden text-sm font-medium text-text-main opacity-0 lg:block" aria-hidden="true">Clear</span>
          <Button
            variant="ghost"
            onClick={onClearFilters}
            disabled={!filters.provider && !filters.startDate && !filters.endDate}
            className="w-full"
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RequestTable({ details, loading, providerNameCache, onViewDetail }) {
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/5">
              <th className="text-left p-4 text-sm font-semibold text-text-main">Timestamp</th>
              <th className="text-left p-4 text-sm font-semibold text-text-main">Model</th>
              <th className="text-left p-4 text-sm font-semibold text-text-main">Provider</th>
              <th className="text-right p-4 text-sm font-semibold text-text-main">Input Tokens</th>
              <th className="text-right p-4 text-sm font-semibold text-text-main">Output Tokens</th>
              <th className="text-left p-4 text-sm font-semibold text-text-main">Latency</th>
              <th className="text-center p-4 text-sm font-semibold text-text-main">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-text-muted">
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : details.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-text-muted">
                  No request details found
                </td>
              </tr>
            ) : (
              details.map((detail) => (
                <tr
                  key={detail.id}
                  className="border-b border-black/5 dark:border-white/5 last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="whitespace-nowrap p-4 text-sm text-text-main">
                    {new Date(detail.timestamp).toLocaleString()}
                  </td>
                  <td className="max-w-[260px] truncate p-4 font-mono text-sm text-text-main">
                    {detail.model}
                  </td>
                  <td className="max-w-[180px] truncate p-4 text-sm text-text-main">
                     <span className="font-medium">
                       {getProviderName(detail.provider, providerNameCache)}
                     </span>
                   </td>
                  <td className="p-4 text-sm text-text-main text-right font-mono">
                    {getInputTokens(detail.tokens).toLocaleString()}
                  </td>
                  <td className="p-4 text-sm text-text-main text-right font-mono">
                    {detail.tokens?.completion_tokens?.toLocaleString() || 0}
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    <div className="flex flex-col gap-0.5">
                      <div>TTFT: <span className="font-mono">{detail.latency?.ttft || 0}ms</span></div>
                      <div>Total: <span className="font-mono">{detail.latency?.total || 0}ms</span></div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetail(detail)}
                    >
                      Detail
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DetailDrawer({ isOpen, detail, providerNameCache, onClose }) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Request Details"
      width="lg"
    >
      {detail && (
        <div className="space-y-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-text-muted">ID:</span>{" "}
              <span className="break-all font-mono text-text-main">{detail.id}</span>
            </div>
            <div>
              <span className="text-text-muted">Timestamp:</span>{" "}
              <span className="text-text-main">{new Date(detail.timestamp).toLocaleString()}</span>
            </div>
            <div>
               <span className="text-text-muted">Provider:</span>{" "}
               <span className="text-text-main font-medium">{getProviderName(detail.provider, providerNameCache)}</span>
             </div>
            <div>
              <span className="text-text-muted">Model:</span>{" "}
              <span className="text-text-main font-mono">{detail.model}</span>
            </div>
            <div>
              <span className="text-text-muted">Status:</span>{" "}
              <span className={cn(
                "font-medium",
                detail.status === "success" ? "text-green-600" : "text-red-600"
              )}>
                {detail.status}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Latency:</span>{" "}
              <span className="text-text-main font-mono">
                TTFT {detail.latency?.ttft || 0}ms / Total {detail.latency?.total || 0}ms
              </span>
            </div>
            <div>
              <span className="text-text-muted">Input Tokens:</span>{" "}
              <span className="text-text-main font-mono">
                {getInputTokens(detail.tokens).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Output Tokens:</span>{" "}
              <span className="text-text-main font-mono">
                {detail.tokens?.completion_tokens?.toLocaleString() || 0}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <CollapsibleSection title="1. Client Request (Input)" defaultOpen={true} icon="input">
              <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                {JSON.stringify(detail.request, null, 2)}
              </pre>
            </CollapsibleSection>

            {detail.providerRequest && (
              <CollapsibleSection title="2. Provider Request (Translated)" icon="translate">
                <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                  {JSON.stringify(detail.providerRequest, null, 2)}
                </pre>
              </CollapsibleSection>
            )}

            {detail.providerResponse && (
              <CollapsibleSection title="3. Provider Response (Raw)" icon="data_object">
                <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                  {typeof detail.providerResponse === 'object'
                    ? JSON.stringify(detail.providerResponse, null, 2)
                    : detail.providerResponse
                  }
                </pre>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="4. Client Response (Final)" defaultOpen={true} icon="output">
              {detail.response?.thinking && (
                <div className="mb-4">
                  <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    Thinking Process
                  </h4>
                  <pre className="max-h-[200px] max-w-full overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 font-mono text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:p-4">
                    {detail.response.thinking}
                  </pre>
                </div>
              )}

              <h4 className="font-semibold text-text-main mb-2 text-xs uppercase tracking-wide opacity-70">
                Content
              </h4>
              <pre className="max-h-[300px] max-w-full overflow-auto rounded-lg border border-black/5 bg-black/5 p-3 font-mono text-xs text-text-main dark:border-white/5 dark:bg-white/5 sm:p-4">
                {detail.response?.content || "[No content]"}
              </pre>
            </CollapsibleSection>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function RequestDetailsTab() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/providers");
      const data = await res.json();
      const cache = await fetchProviderNames();
      dispatch({ type: "SET_PROVIDERS", providers: data.providers || [], cache: cache.providerNameCache });
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    }
  }, []);

  const fetchDetails = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const params = new URLSearchParams({
        page: state.pagination.page.toString(),
        pageSize: state.pagination.pageSize.toString()
      });
      if (state.filters.provider) params.append("provider", state.filters.provider);
      if (state.filters.startDate) params.append("startDate", state.filters.startDate);
      if (state.filters.endDate) params.append("endDate", state.filters.endDate);

      const res = await fetch(`/api/usage/request-details?${params}`);
      const data = await res.json();

      dispatch({ type: "SET_DETAILS", details: data.details || [], pagination: data.pagination });
    } catch (error) {
      console.error("Failed to fetch request details:", error);
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.pagination.page, state.pagination.pageSize, state.filters]);

  // eslint-disable-next-line react-hooks/no-derived-state -- async API fetch, not synchronous derivation
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // eslint-disable-next-line react-hooks/no-derived-state -- async API fetch, not synchronous derivation
  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleViewDetail = (detail) => {
    dispatch({ type: "SET_DRAWER", detail, open: true });
  };

  const handlePageChange = (newPage) => {
    dispatch({ type: "SET_PAGINATION", pagination: { page: newPage } });
  };

  const handlePageSizeChange = (newPageSize) => {
    dispatch({ type: "SET_PAGINATION", pagination: { pageSize: newPageSize, page: 1 } });
  };

  const handleClearFilters = () => {
    dispatch({ type: "SET_FILTERS", filters: { provider: "", startDate: "", endDate: "" } });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FilterBar
        filters={state.filters}
        providers={state.providers}
        onFilterChange={(f) => dispatch({ type: "SET_FILTERS", filters: f })}
        onClearFilters={handleClearFilters}
      />

      <RequestTable
        details={state.details}
        loading={state.loading}
        providerNameCache={state.providerNameCache}
        onViewDetail={handleViewDetail}
      />

      {!state.loading && state.details.length > 0 && (
        <div className="border-t border-black/5 dark:border-white/5">
          <Pagination
            currentPage={state.pagination.page}
            pageSize={state.pagination.pageSize}
            totalItems={state.pagination.totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      <DetailDrawer
        isOpen={state.isDrawerOpen}
        detail={state.selectedDetail}
        providerNameCache={state.providerNameCache}
        onClose={() => dispatch({ type: "SET_DRAWER", detail: null, open: false })}
      />
    </div>
  );
}
