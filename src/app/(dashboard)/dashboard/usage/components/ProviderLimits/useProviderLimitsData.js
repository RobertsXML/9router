"use client";

import { useEffect, useCallback, useRef, useMemo, useReducer } from "react";
import {
  parseQuotaData,
  calculatePercentage,
  sortVisibleConnections,
  buildLoadingState,
  filterQuotaStateByConnections,
  getSafePagination,
  getSafeTotals,
  getPaginationPageValue,
  getProviderOptions,
  reconcileConnectionsPage,
  getQuotaCache,
  setQuotaCache,
  QUOTA_CACHE_KEY,
  REFRESH_INTERVAL_MS,
  CLAUDE_REFRESH_INTERVAL_MS,
  DEPLETED_QUOTA_THRESHOLD,
  AUTO_REFRESH_STORAGE_KEY,
  CONNECTIONS_PAGE_SIZE,
  ACCOUNT_PAGE_SIZE_OPTIONS,
} from "./utils";
import { USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";

const AUTO_PING_SETTINGS_KEYS = {
  claude: "claudeAutoPing",
  codex: "codexAutoPing",
};

// --- Reducers ---

const filterInit = {
  providerFilter: "all",
  providerOptions: [],
  accountFilter: "all",
  quotaSortMode: "default",
  expiringFirst: false,
  providerMenuOpen: false,
};

function filterReducer(state, action) {
  switch (action.type) {
    case "SET_PROVIDER_FILTER":
      return { ...state, providerFilter: action.value };
    case "SET_PROVIDER_OPTIONS":
      return { ...state, providerOptions: action.value };
    case "SET_ACCOUNT_FILTER":
      return { ...state, accountFilter: action.value };
    case "SET_QUOTA_SORT_MODE":
      return { ...state, quotaSortMode: action.value };
    case "SET_EXPIRING_FIRST":
      return { ...state, expiringFirst: action.value };
    case "SET_PROVIDER_MENU_OPEN":
      return { ...state, providerMenuOpen: action.value };
    default:
      return state;
  }
}

const paginationInit = {
  page: 1,
  pageSize: CONNECTIONS_PAGE_SIZE,
  customPageSizeInput: String(CONNECTIONS_PAGE_SIZE),
  pagination: { page: 1, pageSize: CONNECTIONS_PAGE_SIZE, total: 0, totalPages: 1 },
  totals: { eligibleConnections: 0, providerFilteredConnections: 0 },
};

function paginationReducer(state, action) {
  switch (action.type) {
    case "SET_PAGE":
      return { ...state, page: action.value };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.value };
    case "SET_CUSTOM_PAGE_SIZE_INPUT":
      return { ...state, customPageSizeInput: action.value };
    case "SET_PAGINATION":
      return { ...state, pagination: action.value };
    case "SET_TOTALS":
      return { ...state, totals: action.value };
    case "NEXT_PAGE":
      return { ...state, page: Math.min(state.pagination.totalPages, state.page + 1) };
    case "PREV_PAGE":
      return { ...state, page: Math.max(1, state.page - 1) };
    default:
      return state;
  }
}

const busyInit = {
  refreshingAll: false,
  countdown: 60,
  connectionsLoading: true,
  deletingId: null,
  togglingId: null,
  resettingLimitId: null,
  resetConfirmState: null,
  showEditModal: false,
  selectedConnection: null,
  bulkToggling: false,
};

function busyReducer(state, action) {
  switch (action.type) {
    case "SET_REFRESHING_ALL":
      return { ...state, refreshingAll: action.value };
    case "SET_COUNTDOWN":
      return { ...state, countdown: action.value };
    case "SET_CONNECTIONS_LOADING":
      return { ...state, connectionsLoading: action.value };
    case "SET_DELETING_ID":
      return { ...state, deletingId: action.value };
    case "SET_TOGGLING_ID":
      return { ...state, togglingId: action.value };
    case "SETTING_RESETTING_LIMIT_ID":
      return { ...state, resettingLimitId: action.value };
    case "SET_RESET_CONFIRM_STATE":
      return { ...state, resetConfirmState: action.value };
    case "SET_SHOW_EDIT_MODAL":
      return { ...state, showEditModal: action.value };
    case "SET_SELECTED_CONNECTION":
      return { ...state, selectedConnection: action.value };
    case "SET_BULK_TOGGLING":
      return { ...state, bulkToggling: action.value };
    default:
      return state;
  }
}

const dataInit = {
  connections: [],
  quotaData: {},
  loading: {},
  errors: {},
  autoPingMaps: { claude: {}, codex: {} },
  proxyPools: [],
};

function dataReducer(state, action) {
  switch (action.type) {
    case "SET_CONNECTIONS":
      return { ...state, connections: typeof action.value === "function" ? action.value(state.connections) : action.value };
    case "SET_QUOTA_DATA":
      return { ...state, quotaData: typeof action.value === "function" ? action.value(state.quotaData) : action.value };
    case "SET_LOADING":
      return { ...state, loading: typeof action.value === "function" ? action.value(state.loading) : action.value };
    case "SET_ERRORS":
      return { ...state, errors: typeof action.value === "function" ? action.value(state.errors) : action.value };
    case "SET_AUTO_PING_MAPS":
      return { ...state, autoPingMaps: action.value };
    case "SET_PROXY_POOLS":
      return { ...state, proxyPools: action.value };
    default:
      return state;
  }
}

// --- Hook ---

export default function useProviderLimitsData() {
  const [filter, filterDispatch] = useReducer(filterReducer, filterInit);
  const [pagination, paginationDispatch] = useReducer(paginationReducer, paginationInit);
  const [busy, busyDispatch] = useReducer(busyReducer, busyInit);

  // Auto-refresh uses useReducer with lazy init from localStorage.
  // Wrap in a ref-based approach to avoid extra re-renders.
  const autoRefreshRef = useRef(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [autoRefreshState, autoRefreshDispatch] = useReducer(
    (state, action) => {
      if (action.type !== "SET") return state;
      return typeof action.value === "function" ? action.value(state) : action.value;
    },
    undefined,
    () => autoRefreshRef.current(),
  );

  const [data, dataDispatch] = useReducer(dataReducer, dataInit);

  // Convenience aliases
  const { providerFilter, providerOptions, accountFilter, quotaSortMode, expiringFirst, providerMenuOpen } = filter;
  const { page, pageSize, customPageSizeInput } = pagination;
  const { refreshingAll, countdown, connectionsLoading, deletingId, togglingId, resettingLimitId, resetConfirmState, showEditModal, selectedConnection, bulkToggling } = busy;
  const { connections, quotaData, loading, errors, autoPingMaps, proxyPools } = data;
  const autoRefresh = autoRefreshState;

  // Stable dispatch aliases
  const setPage = useCallback((value) => paginationDispatch({ type: "SET_PAGE", value }), []);
  const setProviderMenuOpen = useCallback((value) => filterDispatch({ type: "SET_PROVIDER_MENU_OPEN", value }), []);
  const setProviderFilter = useCallback((value) => filterDispatch({ type: "SET_PROVIDER_FILTER", value }), []);
  const setAccountFilter = useCallback((value) => filterDispatch({ type: "SET_ACCOUNT_FILTER", value }), []);
  const setProviderOptions = useCallback((value) => filterDispatch({ type: "SET_PROVIDER_OPTIONS", value }), []);
  const setExpiringFirst = useCallback((value) => filterDispatch({ type: "SET_EXPIRING_FIRST", value }), []);
  const setQuotaSortMode = useCallback((value) => filterDispatch({ type: "SET_QUOTA_SORT_MODE", value }), []);
  const setPagination = useCallback((value) => paginationDispatch({ type: "SET_PAGINATION", value }), []);
  const setTotals = useCallback((value) => paginationDispatch({ type: "SET_TOTALS", value }), []);
  const setPageSize = useCallback((value) => paginationDispatch({ type: "SET_PAGE_SIZE", value }), []);
  const setCustomPageSizeInput = useCallback((value) => paginationDispatch({ type: "SET_CUSTOM_PAGE_SIZE_INPUT", value }), []);
  const setRefreshingAll = useCallback((value) => busyDispatch({ type: "SET_REFRESHING_ALL", value }), []);
  const setCountdown = useCallback((value) => busyDispatch({ type: "SET_COUNTDOWN", value }), []);
  const setConnectionsLoading = useCallback((value) => busyDispatch({ type: "SET_CONNECTIONS_LOADING", value }), []);
  const setDeletingId = useCallback((value) => busyDispatch({ type: "SET_DELETING_ID", value }), []);
  const setTogglingId = useCallback((value) => busyDispatch({ type: "SET_TOGGLING_ID", value }), []);
  const setResettingLimitId = useCallback((value) => busyDispatch({ type: "SETTING_RESETTING_LIMIT_ID", value }), []);
  const setResetConfirmState = useCallback((value) => busyDispatch({ type: "SET_RESET_CONFIRM_STATE", value }), []);
  const setShowEditModal = useCallback((value) => busyDispatch({ type: "SET_SHOW_EDIT_MODAL", value }), []);
  const setSelectedConnection = useCallback((value) => busyDispatch({ type: "SET_SELECTED_CONNECTION", value }), []);
  const setBulkToggling = useCallback((value) => busyDispatch({ type: "SET_BULK_TOGGLING", value }), []);

  // Data dispatch setters (replace useState setters)
  const setConnections = useCallback((value) => dataDispatch({ type: "SET_CONNECTIONS", value }), []);
  const setQuotaData = useCallback((value) => dataDispatch({ type: "SET_QUOTA_DATA", value }), []);
  const setLoading = useCallback((value) => dataDispatch({ type: "SET_LOADING", value }), []);
  const setErrors = useCallback((value) => dataDispatch({ type: "SET_ERRORS", value }), []);
  const setAutoRefresh = useCallback((value) => autoRefreshDispatch({ type: "SET", value }), []);
  const setAutoPingMaps = useCallback((value) => dataDispatch({ type: "SET_AUTO_PING_MAPS", value }), []);
  const setProxyPools = useCallback((value) => dataDispatch({ type: "SET_PROXY_POOLS", value }), []);

  const lastUpdatedRef = useRef(null);
  const hasHydratedAutoRefreshRef = useRef(true);

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const tickCountRef = useRef(0);

  const fetchConnections = useCallback(
    async (targetPage = page) => {
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
          accountStatus: accountFilter,
          sort: "priority",
        });

        if (providerFilter !== "all") {
          params.set("provider", providerFilter);
        }

        const response = await fetch(
          `/api/providers/client?${params.toString()}`,
        );
        if (!response.ok) throw new Error("Failed to fetch connections");

        const data = await response.json();
        const connectionList = data.connections || [];
        const nextPagination = getSafePagination(data.pagination, pageSize);
        const nextTotals = getSafeTotals(data.totals, connectionList.length);

        setConnections(connectionList);
        setProviderOptions(getProviderOptions(data.providerOptions));
        setPagination(nextPagination);
        setTotals(nextTotals);
        setPage(getPaginationPageValue(data.pagination, targetPage));
        return connectionList;
      } catch (error) {
        console.error("Error fetching connections:", error);
        setConnections([]);
        setProviderOptions([]);
        setPagination({ page: 1, pageSize, total: 0, totalPages: 1 });
        setTotals({ eligibleConnections: 0, providerFilteredConnections: 0 });
        return [];
      }
    },
    [accountFilter, page, pageSize, providerFilter, setConnections, setProviderOptions, setPagination, setTotals, setPage],
  );

  const fetchQuota = useCallback(async (connectionId, provider) => {
    setLoading((prev) => ({ ...prev, [connectionId]: true }));
    setErrors((prev) => ({ ...prev, [connectionId]: null }));

    try {
      console.log(
        `[ProviderLimits] Fetching quota for ${provider} (${connectionId})`,
      );
      const response = await fetch(`/api/usage/${connectionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(
            `[ProviderLimits] Connection not found for ${provider}, skipping`,
          );
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || response.statusText;

        if (response.status === 401) {
          console.warn(
            `[ProviderLimits] Auth error for ${provider}:`,
            errorMsg,
          );
          const quotaEntry = {
            quotas: [],
            message: errorMsg,
          };
          setQuotaData((prev) => ({
            ...prev,
            [connectionId]: quotaEntry,
          }));
          setQuotaCache(connectionId, quotaEntry);
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();
      console.log(`[ProviderLimits] Got quota for ${provider}:`, data);

      const parsedQuotas = parseQuotaData(provider, data);

      const quotaEntry = {
        quotas: parsedQuotas,
        plan: data.plan || null,
        message: data.message || null,
        raw: data,
      };

      setQuotaData((prev) => ({
        ...prev,
        [connectionId]: quotaEntry,
      }));
      setQuotaCache(connectionId, quotaEntry);
    } catch (error) {
      console.error(
        `[ProviderLimits] Error fetching quota for ${provider} (${connectionId}):`,
        error,
      );
      setErrors((prev) => ({
        ...prev,
        [connectionId]: error.message || "Failed to fetch quota",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [connectionId]: false }));
    }
  }, [setLoading, setErrors, setQuotaData]);

  const refreshProvider = useCallback(
    async (connectionId, provider) => {
      await fetchQuota(connectionId, provider);
      lastUpdatedRef.current = new Date();
    },
    [fetchQuota],
  );

  const handleResetCodexLimit = useCallback(
    async (connectionId, provider) => {
      if (provider !== "codex" || resettingLimitId) return;

      setResettingLimitId(connectionId);
      setErrors((prev) => ({ ...prev, [connectionId]: null }));

      try {
        const response = await fetch(`/api/usage/${connectionId}/codex-reset-credits`, { method: "POST" });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || result.error || result.code || "Failed to reset Codex limit");
        }

        await fetchQuota(connectionId, provider);
        lastUpdatedRef.current = new Date();
      } catch (error) {
        setErrors((prev) => ({ ...prev, [connectionId]: error.message || "Failed to reset Codex limit" }));
      } finally {
        setResettingLimitId(null);
      }
    },
    [fetchQuota, resettingLimitId, setResettingLimitId, setErrors],
  );

  const handleDeleteConnection = useCallback(
    async (id) => {
      if (!confirm("Delete this connection?")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
        if (res.ok) {
          setQuotaData((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setLoading((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setErrors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });

          if (typeof window !== "undefined") {
            try {
              const cache = getQuotaCache();
              if (cache[id]) {
                delete cache[id];
                window.localStorage.setItem(
                  QUOTA_CACHE_KEY,
                  JSON.stringify(cache),
                );
              }
            } catch (e) {
              console.error("Error deleting cache entry:", e);
            }
          }

          await reconcileConnectionsPage(fetchConnections, page);
        }
      } catch (error) {
        console.error("Error deleting connection:", error);
      } finally {
        setDeletingId(null);
      }
    },
    [fetchConnections, page, setDeletingId, setQuotaData, setLoading, setErrors],
  );

  const handleToggleConnectionActive = useCallback(
    async (id, isActive) => {
      setTogglingId(id);
      try {
        const res = await fetch(`/api/providers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        });
        if (res.ok) {
          setQuotaData((prev) => {
            const next = { ...prev };
            return next;
          });
          await reconcileConnectionsPage(fetchConnections, page);
        }
      } catch (error) {
        console.error("Error updating connection status:", error);
      } finally {
        setTogglingId(null);
      }
    },
    [fetchConnections, page, setTogglingId, setQuotaData],
  );

  const handleUpdateConnection = useCallback(
    async (formData) => {
      if (!selectedConnection?.id) return;
      const connectionId = selectedConnection.id;
      const provider = selectedConnection.provider;
      try {
        const res = await fetch(`/api/providers/${connectionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchConnections();
          setShowEditModal(false);
          setSelectedConnection(null);
          if (USAGE_SUPPORTED_PROVIDERS.includes(provider)) {
            await fetchQuota(connectionId, provider);
          }
        }
      } catch (error) {
        console.error("Error saving connection:", error);
      }
    },
    [selectedConnection, fetchConnections, fetchQuota, setShowEditModal, setSelectedConnection],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/proxy-pools?isActive=true", { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted && data?.proxyPools) {
          setProxyPools(data.proxyPools);
        }
      })
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => {
      controller.abort();
    };
  }, [setProxyPools]);

  const refreshAll = useCallback(async (force = false) => {
    if (refreshingAll) return;

    setRefreshingAll(true);
    setCountdown(60);

    const tick = (tickCountRef.current += 1);
    const claudeEvery = Math.round(CLAUDE_REFRESH_INTERVAL_MS / REFRESH_INTERVAL_MS);
    const shouldFetch = (conn) =>
      force || conn.provider !== "claude" || tick % claudeEvery === 0;

    try {
      const visibleConnections = await fetchConnections(page);

      setLoading(buildLoadingState(visibleConnections));
      setErrors((prev) =>
        filterQuotaStateByConnections(prev, visibleConnections),
      );
      setQuotaData((prev) =>
        filterQuotaStateByConnections(prev, visibleConnections),
      );

      const toFetch = []; for (const conn of visibleConnections) { if (shouldFetch(conn)) toFetch.push(fetchQuota(conn.id, conn.provider)); }
      await Promise.all(toFetch);

      lastUpdatedRef.current = new Date();
    } catch (error) {
      console.error("Error refreshing all providers:", error);
    } finally {
      setRefreshingAll(false);
    }
  }, [refreshingAll, fetchConnections, fetchQuota, page, setRefreshingAll, setCountdown, setLoading, setErrors, setQuotaData]);

  useEffect(() => {
    const initializeData = async () => {
      setConnectionsLoading(true);
      const visibleConnections = await fetchConnections(page);
      setConnectionsLoading(false);

      setLoading(buildLoadingState(visibleConnections));
      setErrors((prev) =>
        filterQuotaStateByConnections(prev, visibleConnections),
      );
      setQuotaData((prev) =>
        filterQuotaStateByConnections(prev, visibleConnections),
      );

      await Promise.all(
        visibleConnections.map((conn) => fetchQuota(conn.id, conn.provider)),
      );
      lastUpdatedRef.current = new Date();
    };

    initializeData();
  }, [fetchConnections, fetchQuota, page, setConnectionsLoading, setLoading, setErrors, setQuotaData]);

  // Persist auto-refresh preference (skip first run)
  const autoRefreshHydrated = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!autoRefreshHydrated.current) { autoRefreshHydrated.current = true; return; }
    window.localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(autoRefresh));
  }, [autoRefresh]);

  // Load auto-ping per-connection maps
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((s) => setAutoPingMaps({
        claude: s?.claudeAutoPing?.connections || {},
        codex: s?.codexAutoPing?.connections || {},
      }))
      .catch((err) => { if (err.name !== "AbortError") console.error(err); });
    return () => controller.abort();
  }, [setAutoPingMaps]);

  const toggleAutoPing = useCallback(async (connectionId, provider, on) => {
    const settingsKey = AUTO_PING_SETTINGS_KEYS[provider];
    if (!settingsKey) return;

    const previous = autoPingMaps;
    const nextProviderMap = { ...(autoPingMaps[provider] || {}), [connectionId]: on };
    const nextMaps = { ...autoPingMaps, [provider]: nextProviderMap };
    setAutoPingMaps(nextMaps);
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const s = r.ok ? await r.json() : {};
      const cfg = { ...(s[settingsKey] || {}), connections: nextProviderMap };
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [settingsKey]: cfg }),
      });
    } catch {
      setAutoPingMaps(previous);
    }
  }, [autoPingMaps, setAutoPingMaps]);

  // Auto-refresh interval — ref avoids stale closure without re-triggering the effect
  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  useEffect(() => {
    if (!hasHydratedAutoRefreshRef.current || !autoRefresh) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      refreshAllRef.current();
    }, REFRESH_INTERVAL_MS);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, setCountdown]);

  // Pause auto-refresh when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else if (autoRefresh && hasHydratedAutoRefreshRef.current) {
        intervalRef.current = setInterval(() => refreshAllRef.current(), REFRESH_INTERVAL_MS);
        countdownRef.current = setInterval(() => {
          setCountdown((prev) => (prev <= 1 ? 60 : prev - 1));
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoRefresh, setCountdown]);

  const sortedConnections = useMemo(
    () =>
      sortVisibleConnections(
        connections,
        quotaData,
        expiringFirst,
        providerFilter,
        quotaSortMode,
      ),
    [connections, quotaData, expiringFirst, providerFilter, quotaSortMode],
  );

  const isConnectionDepleted = useCallback((conn) => {
    const quotas = quotaData[conn.id]?.quotas;
    if (!quotas?.length) return false;
    return quotas.some((q) => {
      if (!q.total || q.total <= 0) return false;
      return calculatePercentage(q.used, q.total) <= DEPLETED_QUOTA_THRESHOLD;
    });
  }, [quotaData]);

  const bulkSetActive = useCallback(
    async (targetIds, isActive) => {
      if (!targetIds.length || bulkToggling) return;
      setBulkToggling(true);
      try {
        await Promise.all(
          targetIds.map((id) =>
            fetch(`/api/providers/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive }),
            }),
          ),
        );
        await reconcileConnectionsPage(fetchConnections, page);
      } catch (error) {
        console.error("Error bulk toggling connections:", error);
      } finally {
        setBulkToggling(false);
      }
    },
    [bulkToggling, fetchConnections, page, setBulkToggling],
  );

  const handleDisableDepleted = useCallback(() => {
    const ids = []; for (const c of sortedConnections) { if ((c.isActive ?? true) && isConnectionDepleted(c)) ids.push(c.id); }
    bulkSetActive(ids, false);
  }, [sortedConnections, isConnectionDepleted, bulkSetActive]);

  const handleEnableAvailable = useCallback(() => {
    const ids = []; for (const c of sortedConnections) { if (!(c.isActive ?? true) && !isConnectionDepleted(c)) ids.push(c.id); }
    bulkSetActive(ids, true);
  }, [sortedConnections, isConnectionDepleted, bulkSetActive]);

  return {
    // Reducer dispatches
    filterDispatch,
    paginationDispatch,
    busyDispatch,
    // Filter state
    providerFilter,
    providerOptions,
    accountFilter,
    quotaSortMode,
    expiringFirst,
    providerMenuOpen,
    // Pagination state
    page,
    pageSize,
    customPageSizeInput,
    pagination,
    // Busy state
    refreshingAll,
    countdown,
    connectionsLoading,
    deletingId,
    togglingId,
    resettingLimitId,
    resetConfirmState,
    showEditModal,
    selectedConnection,
    bulkToggling,
    // Data state
    connections,
    quotaData,
    loading,
    errors,
    autoRefresh,
    autoPingMaps,
    proxyPools,
    // Derived
    sortedConnections,
    isConnectionDepleted,
    // Stable setters
    setPage,
    setProviderMenuOpen,
    setProviderFilter,
    setAccountFilter,
    setProviderOptions,
    setExpiringFirst,
    setQuotaSortMode,
    setPagination,
    setTotals,
    setPageSize,
    setCustomPageSizeInput,
    setRefreshingAll,
    setCountdown,
    setConnectionsLoading,
    setDeletingId,
    setTogglingId,
    setResettingLimitId,
    setResetConfirmState,
    setShowEditModal,
    setSelectedConnection,
    setBulkToggling,
    setConnections,
    setQuotaData,
    setLoading,
    setErrors,
    setAutoRefresh,
    setAutoPingMaps,
    setProxyPools,
    // Handlers
    fetchConnections,
    fetchQuota,
    refreshProvider,
    handleResetCodexLimit,
    handleDeleteConnection,
    handleToggleConnectionActive,
    handleUpdateConnection,
    refreshAll,
    bulkSetActive,
    handleDisableDepleted,
    handleEnableAvailable,
    toggleAutoPing,
  };
}
