"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useNotificationStore } from "@/store/notificationStore";

function normalizeFormData(data = {}) {
  return {
    name: data.name || "",
    proxyUrl: data.proxyUrl || "",
    noProxy: data.noProxy || "",
    isActive: data.isActive !== false,
    strictProxy: data.strictProxy === true,
  };
}

function parseProxyLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    const parsed = new URL(trimmed);
    const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return {
      proxyUrl: parsed.toString(),
      name: `Imported ${hostLabel}`,
    };
  }

  const parts = trimmed.split(":");
  if (parts.length === 4) {
    const [host, port, username, password] = parts;
    if (!host || !port || !username || !password) {
      throw new Error("Invalid host:port:user:pass format");
    }

    const proxyUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
    const parsed = new URL(proxyUrl);
    return {
      proxyUrl: parsed.toString(),
      name: `Imported ${host}:${port}`,
    };
  }

  throw new Error("Unsupported format");
}

// ── Reducer ─────────────────────────────────────────────────────

const initialState = {
  proxyPools: [],
  loading: true,
  showFormModal: false,
  showBatchImportModal: false,
  showVercelModal: false,
  showCloudflareModal: false,
  showDenoModal: false,
  showRelayMenu: false,
  editingProxyPool: null,
  formData: normalizeFormData(),
  batchImportText: "",
  vercelForm: { vercelToken: "", projectName: "vercel-relay" },
  cloudflareForm: { accountId: "", apiToken: "", projectName: "cloudflare-relay" },
  denoForm: { denoToken: "", orgDomain: "", projectName: "" },
  saving: false,
  importing: false,
  deploying: false,
  testingId: null,
  selectedIds: [],
  healthChecking: false,
  healthProgress: { current: 0, total: 0 },
  bulkBusy: false,
  confirmState: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_POOLS":
      return { ...state, proxyPools: action.pools, loading: false };
    case "SET":
      return { ...state, [action.key]: action.value };
    case "MERGE":
      return { ...state, ...action.values };
    case "UPDATE_POOL":
      return { ...state, proxyPools: state.proxyPools.map((p) => p.id === action.id ? { ...p, ...action.patch } : p) };
    case "REMOVE_POOL":
      return { ...state, proxyPools: state.proxyPools.filter((p) => p.id !== action.id) };
    case "TOGGLE_SELECT": {
      const ids = state.selectedIds.includes(action.id)
        ? state.selectedIds.filter((x) => x !== action.id)
        : [...state.selectedIds, action.id];
      return { ...state, selectedIds: ids };
    }
    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────────────

export default function useProxyPools() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const relayMenuRef = useRef(null);
  const notify = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (relayMenuRef.current && !relayMenuRef.current.contains(e.target)) {
        dispatch({ type: "SET", key: "showRelayMenu", value: false });
      }
    };
    if (state.showRelayMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [state.showRelayMenu]);

  const selectedIdsRef = useRef(state.selectedIds);
  selectedIdsRef.current = state.selectedIds;
  const fetchProxyPools = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy-pools?includeUsage=true", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const pools = data.proxyPools || [];
        dispatch({ type: "SET_POOLS", pools });
        dispatch({ type: "SET", key: "selectedIds", value: selectedIdsRef.current.filter((id) => pools.some((p) => p.id === id)) });
      }
    } catch (error) {
      console.log("Error fetching proxy pools:", error);
    } finally {
      dispatch({ type: "SET", key: "loading", value: false });
    }
  }, [dispatch]);

  useEffect(() => { fetchProxyPools(); }, [fetchProxyPools]);

  const openCreateModal = () => {
    dispatch({ type: "MERGE", values: { editingProxyPool: null, formData: normalizeFormData(), showFormModal: true } });
  };

  const openEditModal = (proxyPool) => {
    dispatch({ type: "MERGE", values: { editingProxyPool: proxyPool, formData: normalizeFormData(proxyPool), showFormModal: true } });
  };

  const handleSave = async () => {
    const payload = {
      name: state.formData.name.trim(),
      proxyUrl: state.formData.proxyUrl.trim(),
      noProxy: state.formData.noProxy.trim(),
      isActive: state.formData.isActive === true,
      strictProxy: state.formData.strictProxy === true,
    };

    if (!payload.name || !payload.proxyUrl) return;

    dispatch({ type: "SET", key: "saving", value: true });
    try {
      const isEdit = !!state.editingProxyPool;
      const res = await fetch(isEdit ? `/api/proxy-pools/${state.editingProxyPool.id}` : "/api/proxy-pools", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchProxyPools();
        dispatch({ type: "MERGE", values: { showFormModal: false, editingProxyPool: null, formData: normalizeFormData() } });
        notify.success(state.editingProxyPool ? "Proxy pool updated" : "Proxy pool created");
      } else {
        const data = await res.json();
        notify.error(data.error || "Failed to save proxy pool");
      }
    } catch (error) {
      console.log("Error saving proxy pool:", error);
    } finally {
      dispatch({ type: "SET", key: "saving", value: false });
    }
  };

  const handleDelete = async (proxyPool) => {
    dispatch({ type: "SET", key: "confirmState", value: {
      title: "Delete Proxy Pool",
      message: `Delete proxy pool "${proxyPool.name}"?`,
      onConfirm: async () => {
        dispatch({ type: "SET", key: "confirmState", value: null });
        try {
          const res = await fetch(`/api/proxy-pools/${proxyPool.id}`, { method: "DELETE" });
          if (res.ok) {
            dispatch({ type: "REMOVE_POOL", id: proxyPool.id });
            notify.success("Proxy pool deleted");
            return;
          }

          const data = await res.json();
          if (res.status === 409) {
            notify.warning(`Cannot delete: ${data.boundConnectionCount || 0} connection(s) are still using this pool.`);
          } else {
            notify.error(data.error || "Failed to delete proxy pool");
          }
        } catch (error) {
          console.log("Error deleting proxy pool:", error);
          notify.error("Failed to delete proxy pool");
        }
      }
    }});
  };

  const handleTest = async (proxyPoolId) => {
    dispatch({ type: "SET", key: "testingId", value: proxyPoolId });
    try {
      const res = await fetch(`/api/proxy-pools/${proxyPoolId}/test`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        notify.error(data.error || "Failed to test proxy");
        return;
      }

      await fetchProxyPools();
      notify.success(data.ok ? "Proxy test passed" : "Proxy test failed");
    } catch (error) {
      console.log("Error testing proxy pool:", error);
      notify.error("Failed to test proxy");
    } finally {
      dispatch({ type: "SET", key: "testingId", value: null });
    }
  };

  const handleToggleActive = async (pool) => {
    const next = !pool.isActive;
    dispatch({ type: "UPDATE_POOL", id: pool.id, patch: { isActive: next } });
    try {
      const res = await fetch(`/api/proxy-pools/${pool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        dispatch({ type: "UPDATE_POOL", id: pool.id, patch: { isActive: pool.isActive } });
        notify.error("Failed to update active state");
      }
    } catch (error) {
      console.log("Error toggling active:", error);
      dispatch({ type: "UPDATE_POOL", id: pool.id, patch: { isActive: pool.isActive } });
    }
  };

  const allSelected = state.proxyPools.length > 0 && state.selectedIds.length === state.proxyPools.length;
  const toggleSelectAll = () => dispatch({ type: "SET", key: "selectedIds", value: allSelected ? [] : state.proxyPools.map((p) => p.id) });
  const clearSelection = () => dispatch({ type: "SET", key: "selectedIds", value: [] });

  const bulkSetActive = async (isActive) => {
    const targets = state.selectedIds.length > 0 ? state.selectedIds : state.proxyPools.map((p) => p.id);
    if (targets.length === 0) return;
    dispatch({ type: "SET", key: "bulkBusy", value: true });
    try {
      const results = await Promise.all(targets.map(async (id) => {
        try {
          const res = await fetch(`/api/proxy-pools/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive }),
          });
          return res.ok;
        } catch { return false; }
      }));
      const ok = results.filter(Boolean).length;
      const failed = results.length - ok;
      await fetchProxyPools();
      notify.success(`${isActive ? "Activated" : "Deactivated"} ${ok}${failed ? `, failed ${failed}` : ""}`);
    } finally {
      dispatch({ type: "SET", key: "bulkBusy", value: false });
    }
  };

  const bulkDelete = async () => {
    if (state.selectedIds.length === 0) return;
    dispatch({ type: "SET", key: "confirmState", value: {
      title: "Delete Proxy Pools",
      message: `Delete ${state.selectedIds.length} proxy pool(s)?`,
      onConfirm: async () => {
        dispatch({ type: "SET", key: "confirmState", value: null });
        dispatch({ type: "SET", key: "bulkBusy", value: true });
        try {
          const deleteResults = await Promise.all(state.selectedIds.map(async (id) => {
            try {
              const res = await fetch(`/api/proxy-pools/${id}`, { method: "DELETE" });
              return res.ok ? "ok" : res.status === 409 ? "blocked" : "failed";
            } catch { return "failed"; }
          }));
          const ok = deleteResults.filter((r) => r === "ok").length;
          const blocked = deleteResults.filter((r) => r === "blocked").length;
          const failed = deleteResults.filter((r) => r === "failed").length;
          await fetchProxyPools();
          clearSelection();
          notify.success(`Deleted ${ok}${blocked ? `, ${blocked} bound` : ""}${failed ? `, ${failed} failed` : ""}`);
        } finally {
          dispatch({ type: "SET", key: "bulkBusy", value: false });
        }
      }
    }});
  };

  const handleHealthCheck = async () => {
    const targets = state.selectedIds.length > 0
      ? state.proxyPools.filter((p) => state.selectedIds.includes(p.id))
      : state.proxyPools;
    if (targets.length === 0) return;
    dispatch({ type: "MERGE", values: { healthChecking: true, healthProgress: { current: 0, total: targets.length } } });
    let alive = 0; const deadIds = [];
    let done = 0;
    const CONCURRENCY = 10;
    const queue = [...targets];

    const worker = async () => {
      while (queue.length > 0) { // react-doctor-disable-line react-doctor/async-await-in-loop -- sequential: worker processes queue items one at a time
        const pool = queue.shift();
        if (!pool) break;
        try {
          const res = await fetch(`/api/proxy-pools/${pool.id}/test`, { method: "POST" });
          const data = await res.json();
          if (res.ok && data.ok) alive += 1; else deadIds.push(pool.id);
        } catch {
          deadIds.push(pool.id);
        } finally {
          done += 1;
          dispatch({ type: "SET", key: "healthProgress", value: { current: done, total: targets.length } });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    await fetchProxyPools();
    dispatch({ type: "MERGE", values: { healthChecking: false, healthProgress: { current: 0, total: 0 } } });

    if (deadIds.length > 0) {
      dispatch({ type: "SET", key: "confirmState", value: {
        title: "Disable Dead Proxies",
        message: `Alive: ${alive}, Dead: ${deadIds.length}.\n\nDisable ${deadIds.length} dead proxies?`,
        onConfirm: async () => {
          dispatch({ type: "SET", key: "confirmState", value: null });
          dispatch({ type: "SET", key: "bulkBusy", value: true });
          try {
            await Promise.all(deadIds.map(async (id) => {
              try {
                await fetch(`/api/proxy-pools/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                });
              } catch {}
            }));
            await fetchProxyPools();
            notify.success(`Disabled ${deadIds.length} dead proxies`);
          } finally {
            dispatch({ type: "SET", key: "bulkBusy", value: false });
          }
        }
      }});
    } else {
      notify.success(`Health check done. Alive: ${alive}, Dead: ${deadIds.length}`);
    }
  };

  const handleVercelDeploy = useCallback(async () => {
    if (!state.vercelForm.vercelToken.trim()) return;
    dispatch({ type: "SET", key: "deploying", value: true });
    try {
      const res = await fetch("/api/proxy-pools/vercel-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.vercelForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        dispatch({ type: "SET", key: "showVercelModal", value: false });
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Vercel relay:", error);
      notify.error("Deploy failed");
    } finally {
      dispatch({ type: "SET", key: "deploying", value: false });
    }
  }, [state.vercelForm, dispatch, fetchProxyPools, notify]);

  const handleCloudflareDeploy = useCallback(async () => {
    if (!state.cloudflareForm.accountId.trim() || !state.cloudflareForm.apiToken.trim()) return;
    dispatch({ type: "SET", key: "deploying", value: true });
    try {
      const res = await fetch("/api/proxy-pools/cloudflare-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.cloudflareForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        dispatch({ type: "SET", key: "showCloudflareModal", value: false });
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Cloudflare relay:", error);
      notify.error("Deploy failed");
    } finally {
      dispatch({ type: "SET", key: "deploying", value: false });
    }
  }, [state.cloudflareForm, dispatch, fetchProxyPools, notify]);

  const handleDenoDeploy = useCallback(async () => {
    if (!state.denoForm.denoToken.trim()) return;
    dispatch({ type: "SET", key: "deploying", value: true });
    try {
      const res = await fetch("/api/proxy-pools/deno-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.denoForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        dispatch({ type: "SET", key: "showDenoModal", value: false });
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Deno relay:", error);
      notify.error("Deploy failed");
    } finally {
      dispatch({ type: "SET", key: "deploying", value: false });
    }
  }, [state.denoForm, dispatch, fetchProxyPools, notify]);

  const handleBatchImport = useCallback(async () => {
    const lines = state.batchImportText
      .split(/\r?\n/)
      .flatMap((line) => { const t = line.trim(); return t ? [t] : []; });

    if (lines.length === 0) {
      notify.warning("Please paste at least one proxy line.");
      return;
    }

    const parsedEntries = [];
    const invalidLines = [];

    lines.forEach((line, index) => {
      try {
        const parsed = parseProxyLine(line);
        if (parsed) {
          parsedEntries.push({
            ...parsed,
            lineNumber: index + 1,
          });
        }
      } catch (error) {
        invalidLines.push(`Line ${index + 1}: ${error.message}`);
      }
    });

    if (invalidLines.length > 0) {
      notify.error(`Invalid proxy format:\n${invalidLines.join("\n")}`);
      return;
    }

    dispatch({ type: "SET", key: "importing", value: true });
    try {
      const existingKeys = new Set(
        state.proxyPools.map((pool) => `${(pool.proxyUrl || "").trim()}|||${(pool.noProxy || "").trim()}`)
      );

      const results = await Promise.all(parsedEntries.map(async (entry) => {
        const dedupeKey = `${entry.proxyUrl}|||`;
        if (existingKeys.has(dedupeKey)) return "skipped";
        try {
          const res = await fetch("/api/proxy-pools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: entry.name,
              proxyUrl: entry.proxyUrl,
              noProxy: "",
              isActive: true,
            }),
          });
          return res.ok ? "ok" : "failed";
        } catch { return "failed"; }
      }));

      const created = results.filter((r) => r === "ok").length;
      const skipped = results.filter((r) => r === "skipped").length;
      const failed = results.filter((r) => r === "failed").length;

      await fetchProxyPools();
      dispatch({ type: "SET", key: "showBatchImportModal", value: false });
      notify.success(`Batch import completed: Created ${created}, Skipped ${skipped}, Failed ${failed}`);
    } catch (error) {
      console.log("Error batch importing proxies:", error);
      notify.error("Batch import failed");
    } finally {
      dispatch({ type: "SET", key: "importing", value: false });
    }
  }, [state.batchImportText, state.proxyPools, dispatch, fetchProxyPools, notify]);

  const activeCount = useMemo(
    () => state.proxyPools.filter((pool) => pool.isActive === true).length,
    [state.proxyPools]
  );

  const handlers = useMemo(() => ({
    setBatchImportText: (text) => dispatch({ type: "SET", key: "batchImportText", value: text }),
    batchImport: handleBatchImport,
    closeBatchImport: () => dispatch({ type: "SET", key: "showBatchImportModal", value: false }),
    setVercelForm: (form) => dispatch({ type: "SET", key: "vercelForm", value: form }),
    vercelDeploy: handleVercelDeploy,
    closeVercel: () => dispatch({ type: "SET", key: "showVercelModal", value: false }),
    setCloudflareForm: (form) => dispatch({ type: "SET", key: "cloudflareForm", value: form }),
    cloudflareDeploy: handleCloudflareDeploy,
    closeCloudflare: () => dispatch({ type: "SET", key: "showCloudflareModal", value: false }),
    setDenoForm: (form) => dispatch({ type: "SET", key: "denoForm", value: form }),
    denoDeploy: handleDenoDeploy,
    closeDeno: () => dispatch({ type: "SET", key: "showDenoModal", value: false }),
    setFormData: (data) => dispatch({ type: "SET", key: "formData", value: data }),
    closeForm: () => dispatch({ type: "MERGE", values: { showFormModal: false, editingProxyPool: null, formData: normalizeFormData() } }),
    closeConfirm: () => dispatch({ type: "SET", key: "confirmState", value: null }),
  }), [handleBatchImport, handleVercelDeploy, handleCloudflareDeploy, handleDenoDeploy, dispatch]);

  return {
    state,
    dispatch,
    relayMenuRef,
    allSelected,
    activeCount,
    toggleSelectAll,
    clearSelection,
    openCreateModal,
    openEditModal,
    handleSave,
    handleDelete,
    handleTest,
    handleToggleActive,
    bulkSetActive,
    bulkDelete,
    handleHealthCheck,
    handleVercelDeploy,
    handleCloudflareDeploy,
    handleDenoDeploy,
    handleBatchImport,
    handlers,
  };
}
